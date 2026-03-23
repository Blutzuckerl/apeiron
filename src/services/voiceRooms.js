const { nanoid } = require('nanoid');

const STALE_SESSION_MS = 15000;

const sessions = new Map();
const rooms = new Map();
const userToSession = new Map();

function toRoomKey(serverId, channelId) {
  return `${Number(serverId)}:${Number(channelId)}`;
}

function getRoom(serverId, channelId) {
  return rooms.get(toRoomKey(serverId, channelId)) || null;
}

function ensureRoom(serverId, channelId) {
  const key = toRoomKey(serverId, channelId);
  const existing = rooms.get(key);
  if (existing) {
    return existing;
  }
  const room = {
    key,
    serverId: Number(serverId),
    channelId: Number(channelId),
    sessionIds: new Set()
  };
  rooms.set(key, room);
  return room;
}

function serializeSession(session) {
  return {
    session_id: session.sessionId,
    user_id: session.userId,
    displayname: session.displayName,
    avatar_url: session.avatarUrl,
    status: session.status,
    speaking: Boolean(session.speaking),
    muted: Boolean(session.muted),
    deafened: Boolean(session.deafened)
  };
}

function listRoomParticipants(serverId, channelId) {
  const room = getRoom(serverId, channelId);
  if (!room) {
    return [];
  }
  return [...room.sessionIds]
    .map((sessionId) => sessions.get(sessionId))
    .filter(Boolean)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map(serializeSession);
}

function destroySession(sessionId) {
  const session = sessions.get(String(sessionId));
  if (!session) {
    return false;
  }

  const room = getRoom(session.serverId, session.channelId);
  if (room) {
    room.sessionIds.delete(session.sessionId);
    if (!room.sessionIds.size) {
      rooms.delete(room.key);
    }
  }

  if (userToSession.get(session.userId) === session.sessionId) {
    userToSession.delete(session.userId);
  }

  sessions.delete(session.sessionId);
  return true;
}

function cleanupStaleSessions() {
  const now = Date.now();
  [...sessions.values()].forEach((session) => {
    if (now - session.lastSeenAt > STALE_SESSION_MS) {
      destroySession(session.sessionId);
    }
  });
}

function createVoiceSession({ serverId, channelId, userId, displayName, avatarUrl, status, canSpeak }) {
  cleanupStaleSessions();

  const existingSessionId = userToSession.get(Number(userId));
  if (existingSessionId) {
    destroySession(existingSessionId);
  }

  const sessionId = nanoid(18);
  const room = ensureRoom(serverId, channelId);
  const now = Date.now();
  const session = {
    sessionId,
    serverId: Number(serverId),
    channelId: Number(channelId),
    userId: Number(userId),
    displayName: String(displayName || 'User'),
    avatarUrl: String(avatarUrl || ''),
    status: ['online', 'idle', 'dnd', 'streaming'].includes(String(status)) ? String(status) : 'offline',
    speaking: false,
    audioLevel: 0,
    muted: !canSpeak,
    deafened: false,
    joinedAt: now,
    lastSeenAt: now,
    pendingSignals: []
  };

  sessions.set(sessionId, session);
  userToSession.set(session.userId, sessionId);
  room.sessionIds.add(sessionId);

  return {
    ok: true,
    sessionId,
    participants: listRoomParticipants(serverId, channelId)
  };
}

function getSession(sessionId, userId) {
  cleanupStaleSessions();
  const session = sessions.get(String(sessionId || ''));
  if (!session) {
    return null;
  }
  if (Number(session.userId) !== Number(userId)) {
    return null;
  }
  return session;
}

function leaveVoiceSession({ sessionId, userId }) {
  const session = getSession(sessionId, userId);
  if (!session) {
    return { ok: false, code: 'session_missing' };
  }
  destroySession(session.sessionId);
  return { ok: true };
}

function syncVoiceSession({ sessionId, userId, muted, deafened }) {
  const session = getSession(sessionId, userId);
  if (!session) {
    return { ok: false, code: 'session_missing' };
  }

  session.lastSeenAt = Date.now();
  if (typeof muted === 'boolean') {
    session.muted = muted;
    if (muted) {
      session.speaking = false;
      session.audioLevel = 0;
    }
  }
  if (typeof deafened === 'boolean') {
    session.deafened = deafened;
  }

  const pendingSignals = session.pendingSignals.splice(0, session.pendingSignals.length);
  return {
    ok: true,
    room: {
      server_id: session.serverId,
      voice_channel_id: session.channelId
    },
    participants: listRoomParticipants(session.serverId, session.channelId),
    signals: pendingSignals
  };
}

function updateVoiceState({ sessionId, userId, speaking, audioLevel, muted, deafened }) {
  const session = getSession(sessionId, userId);
  if (!session) {
    return { ok: false, code: 'session_missing' };
  }

  session.lastSeenAt = Date.now();

  if (typeof muted === 'boolean') {
    session.muted = muted;
  }
  if (typeof deafened === 'boolean') {
    session.deafened = deafened;
  }

  if (session.muted) {
    session.speaking = false;
    session.audioLevel = 0;
  } else {
    session.speaking = Boolean(speaking);
    session.audioLevel = Math.max(0, Math.min(1, Number(audioLevel) || 0));
  }

  return {
    ok: true,
    participant: serializeSession(session)
  };
}

function queueVoiceSignal({ sessionId, userId, targetSessionId, description, candidate }) {
  const session = getSession(sessionId, userId);
  if (!session) {
    return { ok: false, code: 'session_missing' };
  }

  const targetSession = sessions.get(String(targetSessionId || ''));
  if (!targetSession) {
    return { ok: false, code: 'target_missing' };
  }

  if (targetSession.serverId !== session.serverId || targetSession.channelId !== session.channelId) {
    return { ok: false, code: 'target_missing' };
  }

  const signal = {
    signal_id: nanoid(12),
    from_session_id: session.sessionId,
    description: description || null,
    candidate: candidate || null
  };
  targetSession.pendingSignals.push(signal);

  return {
    ok: true,
    signal
  };
}

function getServerVoicePresence(serverId, voiceChannels = []) {
  cleanupStaleSessions();
  return voiceChannels.map((channel) => ({
    id: Number(channel.id),
    participants: listRoomParticipants(serverId, channel.id)
  }));
}

module.exports = {
  createVoiceSession,
  leaveVoiceSession,
  syncVoiceSession,
  updateVoiceState,
  queueVoiceSignal,
  getServerVoicePresence
};
