function parseEnvList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBooleanFlag(value, fallback = true) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function resolveVoiceIceConfig() {
  const stunUrls = parseEnvList(process.env.STUN_URLS || process.env.STUN_URL || '')
    .filter((entry) => entry.toLowerCase().startsWith('stun:'));
  if (!stunUrls.length) {
    stunUrls.push('stun:stun.l.google.com:19302');
  }

  const turnUrls = parseEnvList(process.env.TURN_URLS || process.env.TURN_URL || '')
    .filter((entry) => entry.toLowerCase().startsWith('turn:') || entry.toLowerCase().startsWith('turns:'));
  const turnUser = String(process.env.TURN_USER || '').trim();
  const turnPass = String(process.env.TURN_PASS || '').trim();
  const turnRequired = parseBooleanFlag(process.env.VOICE_REQUIRE_TURN, true);

  const iceServers = [];
  if (stunUrls.length) {
    iceServers.push({ urls: stunUrls.length === 1 ? stunUrls[0] : stunUrls });
  }

  const turnConfigured = turnUrls.length > 0 && Boolean(turnUser) && Boolean(turnPass);
  if (turnConfigured) {
    iceServers.push({
      urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
      username: turnUser,
      credential: turnPass
    });
  }

  let error = '';
  if (turnRequired && !turnConfigured) {
    if (!turnUrls.length) {
      error = 'TURN_URL/TURN_URLS missing';
    } else if (!turnUser || !turnPass) {
      error = 'TURN_USER/TURN_PASS missing';
    } else {
      error = 'TURN config invalid';
    }
  }

  return {
    turnRequired,
    turnConfigured,
    turnUser,
    turnPass,
    stunUrls,
    turnUrls,
    error,
    iceServers
  };
}

module.exports = {
  parseBooleanFlag,
  resolveVoiceIceConfig
};
