const { WebSocketServer } = require('ws');
const {
  findUserById,
  getServerMembership,
  listChannelsForServer
} = require('../db/repositories');
const {
  createVoiceSession,
  leaveVoiceSession,
  syncVoiceSession,
  updateVoiceState,
  queueVoiceSignal,
  getServerVoicePresence
} = require('./voiceRooms');
const { getEffectivePresence } = require('./presence');
const { isLoopbackHost } = require('../utils/lanAccess');

function parseId(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseHostName(value) {
  const host = String(value || '').trim();
  if (!host) {
    return '';
  }
  if (host.startsWith('[')) {
    return host.slice(1).split(']')[0];
  }
  return host.split(':')[0];
}

function normalizePresenceStatus(value) {
  const normalized = String(value || '').toLowerCase();
  return ['online', 'idle', 'dnd', 'streaming'].includes(normalized) ? normalized : 'offline';
}

function getPresenceLabel(status) {
  if (status === 'idle') {
    return 'abwesend';
  }
  if (status === 'dnd') {
    return 'nicht stören';
  }
  if (status === 'streaming') {
    return 'streaming';
  }
  return status;
}

function decorateVoiceParticipant(participant) {
  const livePresence = getEffectivePresence(participant.user_id, participant.status || 'online');
  const status = normalizePresenceStatus(livePresence.status);
  return {
    ...participant,
    status,
    status_label: getPresenceLabel(status),
    last_seen: livePresence.last_seen
  };
}

function decorateVoicePresenceChannels(channels = []) {
  return channels.map((entry) => ({
    ...entry,
    participants: Array.isArray(entry.participants)
      ? entry.participants.map((participant) => decorateVoiceParticipant(participant))
      : []
  }));
}

function createUpgradeResStub() {
  const headers = new Map();
  return {
    getHeader(name) {
      return headers.get(String(name || '').toLowerCase());
    },
    setHeader(name, value) {
      headers.set(String(name || '').toLowerCase(), value);
    },
    removeHeader(name) {
      headers.delete(String(name || '').toLowerCase());
    },
    writeHead() {},
    end() {}
  };
}

function createVoiceRealtimeGateway({
  app,
  path = '/app/voice/realtime'
}) {
  const wsServer = new WebSocketServer({ noServer: true });
  const clients = new Set();
  const clientsByServerId = new Map();
  const clientsBySessionId = new Map();
  const presenceBroadcastTimers = new Map();

  const network = app.locals?.network || {};

  const secureOriginRequired = network.voiceRequiresSecureOrigin !== false;
  const turnRequired = network.voiceRequireTurn !== false;
  const turnConfigured = Boolean(network.turnConfigured);
  const iceServers = Array.isArray(network.voiceIceServers) ? network.voiceIceServers : [];

  const isSecureRequest = (req) => {
    if (!secureOriginRequired) {
      return true;
    }
    if (Boolean(req.socket?.encrypted)) {
      return true;
    }
    const hostname = parseHostName(req.headers?.host);
    if (isLoopbackHost(hostname)) {
      return true;
    }
    if (network.trustProxy) {
      const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
      if (forwardedProto === 'https') {
        return true;
      }
    }
    return false;
  };

  const send = (ws, payload) => {
    if (!ws || ws.readyState !== ws.OPEN) {
      return;
    }
    ws.send(JSON.stringify(payload));
  };

  const sendError = (ctx, code, message) => {
    send(ctx.ws, {
      type: 'voice_error',
      code: String(code || 'voice_error'),
      message: String(message || 'Voice operation failed.')
    });
  };

  const voiceChannelsForServer = (serverId) => listChannelsForServer(serverId).filter((entry) => entry.type === 'voice');

  const buildServerPresencePayload = (serverId) => {
    const channels = decorateVoicePresenceChannels(getServerVoicePresence(serverId, voiceChannelsForServer(serverId)));
    return {
      type: 'voice_presence',
      serverId,
      channels
    };
  };

  const addClientServerSubscription = (ctx, serverId) => {
    const safeServerId = parseId(serverId);
    if (!safeServerId) {
      return;
    }
    ctx.serverSubscriptions.add(safeServerId);
    const bucket = clientsByServerId.get(safeServerId) || new Set();
    bucket.add(ctx);
    clientsByServerId.set(safeServerId, bucket);
  };

  const removeClientServerSubscription = (ctx, serverId) => {
    const safeServerId = parseId(serverId);
    if (!safeServerId) {
      return;
    }
    ctx.serverSubscriptions.delete(safeServerId);
    const bucket = clientsByServerId.get(safeServerId);
    if (!bucket) {
      return;
    }
    bucket.delete(ctx);
    if (!bucket.size) {
      clientsByServerId.delete(safeServerId);
    }
  };

  const bindClientSession = (ctx, serverId, sessionId) => {
    const safeServerId = parseId(serverId);
    const safeSessionId = String(sessionId || '').trim();
    if (!safeServerId || !safeSessionId) {
      return;
    }
    if (ctx.activeSessionId && ctx.activeSessionId !== safeSessionId) {
      const oldBucket = clientsBySessionId.get(ctx.activeSessionId);
      if (oldBucket) {
        oldBucket.delete(ctx);
        if (!oldBucket.size) {
          clientsBySessionId.delete(ctx.activeSessionId);
        }
      }
    }
    ctx.activeServerId = safeServerId;
    ctx.activeSessionId = safeSessionId;
    addClientServerSubscription(ctx, safeServerId);
    const bucket = clientsBySessionId.get(safeSessionId) || new Set();
    bucket.add(ctx);
    clientsBySessionId.set(safeSessionId, bucket);
  };

  const unbindClientSession = (ctx) => {
    if (ctx.activeSessionId) {
      const bucket = clientsBySessionId.get(ctx.activeSessionId);
      if (bucket) {
        bucket.delete(ctx);
        if (!bucket.size) {
          clientsBySessionId.delete(ctx.activeSessionId);
        }
      }
    }
    ctx.activeSessionId = '';
  };

  const broadcastPresenceNow = (serverId) => {
    const safeServerId = parseId(serverId);
    if (!safeServerId) {
      return;
    }
    const payload = buildServerPresencePayload(safeServerId);
    const targets = clientsByServerId.get(safeServerId);
    if (!targets) {
      return;
    }
    targets.forEach((ctx) => send(ctx.ws, payload));
  };

  const schedulePresenceBroadcast = (serverId, delayMs = 90) => {
    const safeServerId = parseId(serverId);
    if (!safeServerId) {
      return;
    }
    if (presenceBroadcastTimers.has(safeServerId)) {
      return;
    }
    const timer = setTimeout(() => {
      presenceBroadcastTimers.delete(safeServerId);
      broadcastPresenceNow(safeServerId);
    }, Math.max(10, Number(delayMs || 90)));
    presenceBroadcastTimers.set(safeServerId, timer);
  };

  const leaveActiveSession = (ctx, { silent = false } = {}) => {
    const activeServerId = parseId(ctx.activeServerId);
    const activeSessionId = String(ctx.activeSessionId || '').trim();
    if (!activeServerId || !activeSessionId) {
      return;
    }
    const result = leaveVoiceSession({
      sessionId: activeSessionId,
      userId: ctx.userId
    });
    unbindClientSession(ctx);
    ctx.activeServerId = 0;
    if (!silent) {
      send(ctx.ws, {
        type: 'voice_left',
        serverId: activeServerId,
        sessionId: activeSessionId,
        ok: result.ok === true
      });
    }
    schedulePresenceBroadcast(activeServerId, 20);
  };

  const assertMembershipAndChannel = (serverId, channelId, userId) => {
    const membership = getServerMembership(serverId, userId);
    if (!membership) {
      return { ok: false, code: 'not_member' };
    }
    const channel = listChannelsForServer(serverId)
      .find((entry) => Number(entry.id) === Number(channelId));
    if (!channel || channel.type !== 'voice') {
      return { ok: false, code: 'voice_channel_missing' };
    }
    return { ok: true, membership, channel };
  };

  const syncSessionState = (ctx, payload = {}) => {
    const sessionId = String(payload.sessionId || ctx.activeSessionId || '').trim();
    if (!sessionId) {
      sendError(ctx, 'session_missing', 'Voice session missing.');
      return;
    }
    const result = syncVoiceSession({
      sessionId,
      userId: ctx.userId,
      muted: typeof payload.muted === 'boolean' ? payload.muted : undefined,
      deafened: typeof payload.deafened === 'boolean' ? payload.deafened : undefined
    });
    if (!result.ok) {
      sendError(ctx, result.code, 'Voice session not found.');
      return;
    }
    bindClientSession(ctx, result.room.server_id, sessionId);
    const serverId = result.room.server_id;
    const decoratedParticipants = Array.isArray(result.participants)
      ? result.participants.map((entry) => decorateVoiceParticipant(entry))
      : [];
    const decoratedSignals = Array.isArray(result.signals)
      ? result.signals
      : [];
    send(ctx.ws, {
      type: 'voice_synced',
      serverId,
      room: result.room,
      participants: decoratedParticipants,
      signals: decoratedSignals,
      serverPresence: buildServerPresencePayload(serverId).channels
    });
    schedulePresenceBroadcast(serverId, 20);
  };

  const handleMessage = (ctx, rawMessage) => {
    let payload = null;
    try {
      payload = JSON.parse(String(rawMessage || '{}'));
    } catch (_error) {
      sendError(ctx, 'invalid_payload', 'Malformed realtime payload.');
      return;
    }
    const type = String(payload?.type || '').trim().toLowerCase();
    if (!type) {
      sendError(ctx, 'missing_type', 'Message type missing.');
      return;
    }

    if (type === 'voice_subscribe') {
      const serverId = parseId(payload.serverId);
      if (!serverId) {
        sendError(ctx, 'invalid_server', 'Invalid server id.');
        return;
      }
      if (!getServerMembership(serverId, ctx.userId)) {
        sendError(ctx, 'not_member', 'Not a member of this server.');
        return;
      }
      addClientServerSubscription(ctx, serverId);
      send(ctx.ws, buildServerPresencePayload(serverId));
      return;
    }

    if (type === 'voice_unsubscribe') {
      removeClientServerSubscription(ctx, payload.serverId);
      return;
    }

    if (type === 'voice_join') {
      if (!isSecureRequest(ctx.req)) {
        sendError(ctx, 'voice_requires_https', 'Voice requires HTTPS over LAN.');
        return;
      }
      if (turnRequired && !turnConfigured) {
        sendError(ctx, 'turn_required', 'Voice requires TURN configuration.');
        return;
      }
      const serverId = parseId(payload.serverId);
      const channelId = parseId(payload.channelId);
      if (!serverId || !channelId) {
        sendError(ctx, 'invalid_target', 'Server or channel is invalid.');
        return;
      }

      const context = assertMembershipAndChannel(serverId, channelId, ctx.userId);
      if (!context.ok) {
        sendError(ctx, context.code, 'Unable to join voice room.');
        return;
      }

      if (ctx.activeSessionId) {
        leaveActiveSession(ctx, { silent: true });
      }

      const user = findUserById(ctx.userId);
      const result = createVoiceSession({
        serverId,
        channelId,
        userId: ctx.userId,
        displayName: user?.display_name || user?.username || 'User',
        avatarUrl: user?.avatar_url || '',
        status: user?.presence_status || 'online',
        canSpeak: Boolean(context.membership)
      });
      bindClientSession(ctx, serverId, result.sessionId);
      send(ctx.ws, {
        type: 'voice_joined',
        ok: true,
        serverId,
        sessionId: result.sessionId,
        room: {
          server_id: serverId,
          voice_channel_id: channelId
        },
        permissions: {
          canJoinVoice: true,
          canSpeak: Boolean(context.membership)
        },
        participants: result.participants.map((entry) => decorateVoiceParticipant(entry)),
        serverPresence: buildServerPresencePayload(serverId).channels
      });
      schedulePresenceBroadcast(serverId, 20);
      return;
    }

    if (type === 'voice_leave') {
      leaveActiveSession(ctx);
      return;
    }

    if (type === 'voice_resync' || type === 'voice_sync') {
      syncSessionState(ctx, payload);
      return;
    }

    if (type === 'voice_state') {
      const result = updateVoiceState({
        sessionId: payload.sessionId || ctx.activeSessionId,
        userId: ctx.userId,
        speaking: Boolean(payload.speaking),
        audioLevel: Number(payload.audioLevel || 0),
        muted: typeof payload.muted === 'boolean' ? payload.muted : undefined,
        deafened: typeof payload.deafened === 'boolean' ? payload.deafened : undefined
      });
      if (!result.ok) {
        sendError(ctx, result.code, 'Voice state update failed.');
        return;
      }
      const serverId = parseId(ctx.activeServerId);
      if (serverId) {
        schedulePresenceBroadcast(serverId, 65);
      }
      return;
    }

    if (type === 'voice_signal') {
      const sourceSessionId = String(payload.sessionId || ctx.activeSessionId || '').trim();
      const targetSessionId = String(payload.targetSessionId || '').trim();
      const result = queueVoiceSignal({
        sessionId: sourceSessionId,
        userId: ctx.userId,
        targetSessionId,
        description: payload.description || null,
        candidate: payload.candidate || null
      });
      if (!result.ok) {
        sendError(ctx, result.code, 'Voice signaling failed.');
        return;
      }
      const targetClients = clientsBySessionId.get(targetSessionId);
      if (targetClients?.size) {
        targetClients.forEach((targetCtx) => {
          send(targetCtx.ws, {
            type: 'voice_signal',
            serverId: parseId(targetCtx.activeServerId || ctx.activeServerId),
            signal: result.signal || {
              from_session_id: sourceSessionId,
              description: payload.description || null,
              candidate: payload.candidate || null
            }
          });
        });
      }
      return;
    }

    if (type === 'voice_ping') {
      send(ctx.ws, { type: 'voice_pong', ts: Date.now() });
      return;
    }

    sendError(ctx, 'unsupported_type', `Unsupported type: ${type}`);
  };

  wsServer.on('connection', (ws, req) => {
    const userId = parseId(req.session?.userId);
    const user = findUserById(userId);
    if (!userId || !user) {
      ws.close(4401, 'Unauthorized');
      return;
    }
    const ctx = {
      ws,
      req,
      userId,
      serverSubscriptions: new Set(),
      activeServerId: 0,
      activeSessionId: '',
      heartbeatTimerId: 0
    };
    clients.add(ctx);

    send(ws, {
      type: 'voice_ready',
      secureOriginRequired,
      secureOriginReady: isSecureRequest(req),
      turnRequired,
      turnConfigured,
      iceServers
    });

    ws.on('message', (message) => {
      handleMessage(ctx, message);
    });

    ws.on('close', () => {
      if (ctx.heartbeatTimerId) {
        clearInterval(ctx.heartbeatTimerId);
      }
      leaveActiveSession(ctx, { silent: true });
      [...ctx.serverSubscriptions].forEach((serverId) => {
        removeClientServerSubscription(ctx, serverId);
      });
      unbindClientSession(ctx);
      clients.delete(ctx);
    });

    ws.on('error', () => {
      ws.close();
    });

    ctx.heartbeatTimerId = setInterval(() => {
      if (ws.readyState !== ws.OPEN) {
        return;
      }
      send(ws, { type: 'voice_ping', ts: Date.now() });
      if (ctx.activeSessionId) {
        syncSessionState(ctx, {
          sessionId: ctx.activeSessionId
        });
      }
    }, 7000);
  });

  const attachToServer = (server) => {
    if (!server) {
      return;
    }
    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url || '/', 'http://voice.local');
      if (url.pathname !== path) {
        return;
      }
      const sessionMiddleware = app.locals?.sessionMiddleware;
      if (typeof sessionMiddleware !== 'function') {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
        return;
      }
      sessionMiddleware(req, createUpgradeResStub(), (error) => {
        if (error || !req.session?.userId) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        wsServer.handleUpgrade(req, socket, head, (ws) => {
          wsServer.emit('connection', ws, req);
        });
      });
    });
  };

  return {
    attachToServer
  };
}

module.exports = {
  createVoiceRealtimeGateway
};
