const listeners = new Set();
const trackedUsers = new Map();

const HEARTBEAT_TIMEOUT_MS = Math.max(15_000, Number(process.env.PRESENCE_HEARTBEAT_TIMEOUT_MS) || 75_000);
const SWEEP_INTERVAL_MS = Math.max(2_000, Number(process.env.PRESENCE_SWEEP_INTERVAL_MS) || 5_000);

function normalizeManualStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['online', 'idle', 'dnd', 'streaming', 'invisible'].includes(normalized)) {
    return normalized;
  }
  return 'online';
}

function toIsoOrNull(value) {
  const stamp = Number(value || 0);
  if (!stamp) {
    return null;
  }
  return new Date(stamp).toISOString();
}

function ensureTrackedUser(userId) {
  const numericId = Number(userId || 0);
  if (!numericId) {
    return null;
  }

  let entry = trackedUsers.get(numericId);
  if (!entry) {
    entry = {
      userId: numericId,
      manualStatus: 'online',
      clientIdle: false,
      lastHeartbeatAt: 0,
      lastSeenAt: 0,
      lastBroadcastStatus: 'offline'
    };
    trackedUsers.set(numericId, entry);
  }
  return entry;
}

function isHeartbeatFresh(entry, at = Date.now()) {
  if (!entry || !entry.lastHeartbeatAt) {
    return false;
  }
  return (at - entry.lastHeartbeatAt) <= HEARTBEAT_TIMEOUT_MS;
}

function resolveEffectiveStatus(entry, manualStatus = entry?.manualStatus, at = Date.now()) {
  const normalizedManual = normalizeManualStatus(manualStatus);
  if (!isHeartbeatFresh(entry, at)) {
    return 'offline';
  }
  if (normalizedManual === 'invisible') {
    return 'offline';
  }
  if (normalizedManual === 'dnd') {
    return 'dnd';
  }
  if (normalizedManual === 'streaming') {
    return 'streaming';
  }
  if (normalizedManual === 'idle') {
    return 'idle';
  }
  return entry?.clientIdle ? 'idle' : 'online';
}

function serializePresence(entry, at = Date.now()) {
  if (!entry) {
    return {
      user_id: 0,
      status: 'offline',
      last_seen: null
    };
  }

  return {
    user_id: Number(entry.userId),
    status: resolveEffectiveStatus(entry, entry.manualStatus, at),
    last_seen: toIsoOrNull(entry.lastSeenAt)
  };
}

function emitPresenceUpdate(payload) {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (_error) {
      // Ignore broken listeners; route teardown removes them.
    }
  });
}

function maybeBroadcast(entry, at = Date.now()) {
  if (!entry) {
    return serializePresence(null, at);
  }

  const snapshot = serializePresence(entry, at);
  if (snapshot.status !== entry.lastBroadcastStatus) {
    entry.lastBroadcastStatus = snapshot.status;
    emitPresenceUpdate(snapshot);
  }
  return snapshot;
}

function touchRequestPresence(userId, { manualStatus } = {}) {
  const entry = ensureTrackedUser(userId);
  if (!entry) {
    return serializePresence(null);
  }

  entry.manualStatus = normalizeManualStatus(manualStatus || entry.manualStatus);
  const now = Date.now();
  entry.lastHeartbeatAt = now;
  entry.lastSeenAt = now;
  return maybeBroadcast(entry, now);
}

function touchHeartbeat(userId, { manualStatus, clientIdle } = {}) {
  const entry = ensureTrackedUser(userId);
  if (!entry) {
    return serializePresence(null);
  }

  const now = Date.now();
  entry.manualStatus = normalizeManualStatus(manualStatus || entry.manualStatus);
  entry.clientIdle = Boolean(clientIdle);
  entry.lastHeartbeatAt = now;
  entry.lastSeenAt = now;
  return maybeBroadcast(entry, now);
}

function syncManualPresence(userId, manualStatus) {
  const entry = ensureTrackedUser(userId);
  if (!entry) {
    return serializePresence(null);
  }

  entry.manualStatus = normalizeManualStatus(manualStatus || entry.manualStatus);
  return maybeBroadcast(entry);
}

function markDisconnected(userId, { manualStatus } = {}) {
  const entry = ensureTrackedUser(userId);
  if (!entry) {
    return serializePresence(null);
  }

  const now = Date.now();
  entry.manualStatus = normalizeManualStatus(manualStatus || entry.manualStatus);
  entry.lastHeartbeatAt = 0;
  entry.clientIdle = false;
  entry.lastSeenAt = now;
  return maybeBroadcast(entry, now);
}

function getEffectivePresence(userId, manualStatus) {
  const entry = ensureTrackedUser(userId);
  if (!entry) {
    return serializePresence(null);
  }

  entry.manualStatus = normalizeManualStatus(manualStatus || entry.manualStatus);
  return serializePresence(entry);
}

function getPresenceBulk() {
  const now = Date.now();
  const users = {};
  trackedUsers.forEach((entry, userId) => {
    users[userId] = serializePresence(entry, now);
  });
  return { users };
}

function subscribe(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function sweepPresenceStates() {
  const now = Date.now();
  trackedUsers.forEach((entry) => {
    maybeBroadcast(entry, now);
  });
}

const sweepTimer = setInterval(sweepPresenceStates, SWEEP_INTERVAL_MS);
if (typeof sweepTimer.unref === 'function') {
  sweepTimer.unref();
}

module.exports = {
  getEffectivePresence,
  getPresenceBulk,
  markDisconnected,
  subscribe,
  syncManualPresence,
  touchHeartbeat,
  touchRequestPresence
};
