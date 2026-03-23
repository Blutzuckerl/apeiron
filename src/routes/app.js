const express = require('express');
const { nanoid } = require('nanoid');
const {
  listDMThreadsForUser,
  listParticipantsForThread,
  listMessagesForThread,
  listMessagesForThreadThroughMessage,
  getLatestMessageIdForThread,
  markThreadRead,
  setThreadMute,
  createDirectThread,
  createGroupThread,
  updateGroupThread,
  addParticipantToGroup,
  removeParticipantFromGroup,
  createMessageInThread,
  listServersForUser,
  getServerMembership,
  canManageServer,
  canInviteToServer,
  serverSlugExists,
  createServerWithDefaults,
  listDiscoverServersForUser,
  joinServer,
  listServerCategories,
  createServerCategory,
  listChannelsForServer,
  createServerChannel,
  updateServerChannel,
  deleteServerChannel,
  createServerInvite,
  listActiveServerInvites,
  useServerInviteToken,
  getServerNotificationSettings,
  updateServerNotificationSettings,
  getServerPrivacySettings,
  updateServerPrivacySettings,
  markServerRead,
  undoServerMarkRead,
  updateServerOverview,
  getServerAppInstallation,
  upsertServerAppInstallation,
  removeServerAppInstallation,
  getLatestServerAppActivity,
  countServerAppActivitySince,
  recordServerAppActivity,
  leaveServer,
  listMessagesForChannel,
  createMessageInChannel,
  addReactionToMessage,
  listMembersForServer,
  findUserProfileById,
  countMutualServers,
  countMutualFriends,
  listMutualServers,
  listMutualFriends,
  findUserByUsername,
  searchUsers,
  findUserByHandle,
  listFriendsByTab,
  canSendFriendRequest,
  sendFriendRequest,
  resolveFriendRequest,
  blockUser,
  unblockUser,
  canStartDirectDM,
  isBlockedBetween,
  ensureSokratesThreadForUser,
  isAiDmThread,
  getUserSettings,
  updateUserSettings,
  getGlobalSettingsState,
  updateAccountIdentity,
  applyEmailVerificationToken,
  changeUserPassword,
  incrementSessionVersion,
  deactivateUserAccount,
  deleteUserAccount,
  updateUserProfileSettings,
  getUserProfileExtras,
  upsertUserProfileExtras,
  findGameCoverCacheByName,
  upsertGameCoverCache,
  listUserProfileMedia,
  countUserProfileMedia,
  createUserProfileMedia,
  updateNotificationSettings,
  updateAppearanceSettings,
  updateAccessibilitySettings,
  updateVoiceVideoSettings,
  updateLanguageSettings,
  updateAiProviderSettings,
  updateConnections,
  getMessageById,
  updateMessageForActor,
  deleteMessageForActor,
  findMessageActionContext,
  findAgentReplyAfterMessage,
  findThreadByIdForUser,
  SOKRATES_AGENT_SLUG,
  SOKRATES_DISPLAY_NAME,
  SOKRATES_ABOUT_ME,
  SOKRATES_AVATAR_URL,
  SOKRATES_BANNER_URL,
  ensureSokratesAgentUser,
  listAvailableCustomEmojis,
  findUserEmojiByName,
  createUserEmoji,
  listAvailableCustomEmojisByIds,
  getEmojiPickerState,
  setEmojiFavorites,
  pushRecentEmoji,
  getGifPickerState,
  setGifFavorites,
  pushRecentGif,
  deleteUserEmojiForActor,
  createGlobalGifAsset,
  listGlobalGifAssets,
  listGlobalGifsByIds,
  deleteGifAssetForActor
} = require('../db/repositories');
const { resolveFavoriteGameCover, normalizeGameTitle } = require('../services/gameCovers');
const {
  createVoiceSession,
  leaveVoiceSession,
  syncVoiceSession,
  updateVoiceState,
  queueVoiceSignal,
  getServerVoicePresence
} = require('../services/voiceRooms');
const {
  generateSokratesReply,
  getSokratesAvailability,
  getSokratesStatus,
  SOKRATES_SERVER_SYSTEM_PROMPT,
  SokratesServiceError,
  getSokratesPersonaErrorMessage
} = require('../services/sokrates');
const {
  getEffectivePresence,
  getPresenceBulk,
  markDisconnected,
  subscribe,
  syncManualPresence,
  touchHeartbeat
} = require('../services/presence');
const {
  IMAGE_MIME_TYPES,
  PHOTO_MIME_TYPES,
  isDataUrl,
  resolveProfileAssets,
  writeDataUrlToUploads
} = require('../utils/profileAssets');
const { isLoopbackHost } = require('../utils/lanAccess');

const router = express.Router();

const sendBuckets = new Map();
const aiReplyBuckets = new Map();
const aiReplyInflightThreads = new Map();
const aiReplyCooldowns = new Map();
const aiTransientFailureNotices = new Map();
const aiTraceStore = new Map();
const MAX_SOKRATES_PROMPT_CHARS = 4000;
const MAX_GIF_PICKER_RESULTS = 120;
const AI_TRANSIENT_ERROR_DEDUP_MS = 30000;
const AI_TRACE_TTL_MS = 15 * 60 * 1000;
const SOKRATES_SERVER_APP_ID = 'sokrates';
const SOKRATES_DISCUSSION_MODE_LINES = Object.freeze([
  'Du kannst Behauptungen prüfen lassen, Begriffe klären, Widersprüche suchen.',
  'Ich antworte mit Rückfragen und kurzen, präzisen Schritten.',
  'Wenn du willst, nenne These → Grund → Gegenbeispiel.'
]);
const SOKRATES_CAPABILITIES = Object.freeze([
  'Begriffsklärung',
  'Argumentprüfung',
  'Unterscheidung von Möglichkeit vs Wahrscheinlichkeit',
  'Dialektik / Elenchos'
]);
const ABOUT_PLUS_FIELD_DEFINITIONS = Object.freeze([
  {
    key: 'favorite_food',
    label: 'Lieblingsessen',
    type: 'text_short',
    kind: 'food',
    editor_type: 'text',
    max_length: 120,
    supports_image: true
  },
  {
    key: 'favorite_color',
    label: 'Lieblingsfarbe',
    type: 'color',
    kind: 'color',
    editor_type: 'color',
    max_length: 7
  },
  {
    key: 'favorite_game',
    label: 'Lieblingsvideospiel',
    type: 'text_short',
    kind: 'text',
    editor_type: 'text',
    max_length: 120,
    supports_image: true
  },
  {
    key: 'favorite_music',
    label: 'Lieblingsmusik',
    type: 'text_short',
    kind: 'text',
    editor_type: 'text',
    max_length: 120
  },
  {
    key: 'favorite_book',
    label: 'Lieblingsbuch',
    type: 'text_short',
    kind: 'text',
    editor_type: 'text',
    max_length: 120
  },
  {
    key: 'favorite_quote',
    label: 'Lieblingszitat',
    type: 'quote',
    kind: 'quote',
    editor_type: 'textarea',
    editor_rows: 3,
    max_length: 320
  },
  {
    key: 'dislikes',
    label: 'Was ich nicht mag',
    type: 'list',
    kind: 'list',
    editor_type: 'textarea',
    editor_rows: 4,
    max_length: 480
  },
  {
    key: 'bio',
    label: 'Weiteres über mich',
    type: 'text_long',
    kind: 'long_text',
    editor_type: 'textarea',
    editor_rows: 5,
    max_length: 1200
  },
  {
    key: 'hobbies',
    label: 'Hobbys / Beschäftigung',
    type: 'list',
    kind: 'text',
    editor_type: 'text',
    max_length: 160
  },
  {
    key: 'values',
    label: 'Werte / Prinzipien',
    type: 'list',
    kind: 'long_text',
    editor_type: 'textarea',
    editor_rows: 4,
    max_length: 480
  },
  {
    key: 'favorite_question',
    label: 'Lieblingsfrage',
    type: 'text_short',
    kind: 'text',
    editor_type: 'text',
    max_length: 180
  },
  {
    key: 'discussion_topics',
    label: 'Themen, über die ich diskutieren will',
    type: 'list',
    kind: 'long_text',
    editor_type: 'textarea',
    editor_rows: 4,
    max_length: 480
  },
  {
    key: 'avoided_topics',
    label: 'Themen, die ich meide',
    type: 'list',
    kind: 'long_text',
    editor_type: 'textarea',
    editor_rows: 4,
    max_length: 480
  },
  {
    key: 'pronouns',
    label: 'Pronouns',
    type: 'text_short',
    kind: 'text',
    editor_type: 'text',
    max_length: 64
  },
  {
    key: 'profile_status',
    label: 'Status',
    type: 'text_short',
    kind: 'text',
    editor_type: 'text',
    max_length: 120
  },
  {
    key: 'links',
    label: 'Links',
    type: 'list',
    kind: 'list',
    editor_type: 'textarea',
    editor_rows: 4,
    max_length: 480
  },
  {
    key: 'media_card',
    label: 'Media Card',
    type: 'media_card',
    kind: 'media_card',
    editor_type: 'text',
    max_length: 160
  }
]);
const PROFILE_PHOTO_MAX_ITEMS = 18;
const PROFILE_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const ABOUT_PLUS_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const SERVER_ICON_MAX_BYTES = 2 * 1024 * 1024;
const SERVER_BANNER_MAX_BYTES = 6 * 1024 * 1024;
const SERVER_SETTINGS_SECTIONS = Object.freeze([
  'overview',
  'channels',
  'categories',
  'members',
  'moderation',
  'apps'
]);
const SOKRATES_SERVER_REPLY_CONTEXT_LIMIT = 6;
const SOKRATES_SERVER_DEFAULT_REACTION_POOL = Object.freeze(['✅', '🤔', '😼', '👀', '🔥']);
const SOKRATES_SERVER_PROBABILITY_PRESETS = Object.freeze({
  low: { probability: 0.02, channelCooldownMs: 300000, serverHourCap: 8 },
  medium: { probability: 0.04, channelCooldownMs: 180000, serverHourCap: 12 },
  high: { probability: 0.05, channelCooldownMs: 120000, serverHourCap: 20 }
});
const SOKRATES_SERVER_REACTION_RATE_PROBABILITIES = Object.freeze({
  off: 0,
  rare: 0.02,
  normal: 0.04,
  frequent: 0.06
});
const SOKRATES_SERVER_REPLY_RATE_PROBABILITIES = Object.freeze({
  off: 0,
  rare: 0.02,
  normal: 0.04
});
const HTTP_STATUS_REASONS = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout'
};

function normalizeBooleanFlag(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const lowered = String(value || '').trim().toLowerCase();
  if (!lowered) {
    return Boolean(fallback);
  }
  if (['1', 'true', 'on', 'yes'].includes(lowered)) {
    return true;
  }
  if (['0', 'false', 'off', 'no'].includes(lowered)) {
    return false;
  }
  return Boolean(fallback);
}

function resolveSokratesServerPreset(value, fallback = 'medium') {
  const key = String(value || '').trim().toLowerCase();
  return SOKRATES_SERVER_PROBABILITY_PRESETS[key] ? key : fallback;
}

function createDefaultSokratesServerSettings() {
  const preset = SOKRATES_SERVER_PROBABILITY_PRESETS.medium;
  return {
    enabled: true,
    reaction_rate: 'rare',
    reply_rate: 'rare',
    provider_unavailable_behavior: 'silent',
    allow_text: true,
    allow_reactions: true,
    channel_scope: 'all',
    channels_allowlist: [],
    reaction_pool: [...SOKRATES_SERVER_DEFAULT_REACTION_POOL],
    probability_preset: 'medium',
    probability: preset.probability,
    reaction_share: 0.7,
    text_share: 0.3,
    channel_cooldown_ms: preset.channelCooldownMs,
    server_hour_cap: preset.serverHourCap,
    ignore_bots: true,
    min_message_length: 8
  };
}

function normalizeSokratesReactionRate(value, fallback = 'rare') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['off', 'rare', 'normal', 'frequent'].includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function normalizeSokratesReplyRate(value, fallback = 'rare') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['off', 'rare', 'normal'].includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function deriveSokratesRateFromProbability(probability, { kind = 'reaction', fallback = 'rare' } = {}) {
  const numeric = Math.max(0, Number(probability || 0));
  if (numeric <= 0.0001) {
    return 'off';
  }
  if (kind === 'reply') {
    return numeric >= 0.03 ? 'normal' : 'rare';
  }
  if (numeric < 0.03) {
    return 'rare';
  }
  if (numeric < 0.055) {
    return 'normal';
  }
  return 'frequent';
}

function deriveSokratesPresetFromProbability(probability, fallback = 'medium') {
  const numeric = Math.max(0, Number(probability || 0));
  if (numeric <= 0.03) {
    return 'low';
  }
  if (numeric <= 0.055) {
    return 'medium';
  }
  if (numeric > 0.055) {
    return 'high';
  }
  return fallback;
}

function normalizeIdList(value, allowedIds = []) {
  const allow = allowedIds.length ? new Set(allowedIds.map((entry) => Number(entry || 0)).filter(Boolean)) : null;
  const items = Array.isArray(value)
    ? value
    : (typeof value === 'string' && value.trim()
      ? value.split(',')
      : []);
  const unique = new Set();

  items.forEach((entry) => {
    const numeric = Number(entry || 0);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      return;
    }
    if (allow && !allow.has(numeric)) {
      return;
    }
    unique.add(numeric);
  });

  return [...unique];
}

function normalizeSokratesServerReactionPool(value) {
  const items = Array.isArray(value) ? value : [];
  const unique = [...new Set(items.map((entry) => String(entry || '').trim()).filter(Boolean))];
  return unique.slice(0, 12).length ? unique.slice(0, 12) : [...SOKRATES_SERVER_DEFAULT_REACTION_POOL];
}

function normalizeSokratesServerSettings(raw, { channelIds = [] } = {}) {
  const base = createDefaultSokratesServerSettings();
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const hasExplicitRates = source.reaction_rate !== undefined
    || source.reply_rate !== undefined
    || source.reactionRate !== undefined
    || source.replyRate !== undefined;
  const legacyPresetKey = resolveSokratesServerPreset(source.probability_preset, base.probability_preset);
  const legacyPreset = SOKRATES_SERVER_PROBABILITY_PRESETS[legacyPresetKey];
  const channelScope = String(source.channel_scope || base.channel_scope).trim().toLowerCase() === 'selected'
    ? 'selected'
    : 'all';
  let reactionRate = normalizeSokratesReactionRate(
    source.reaction_rate ?? source.reactionRate,
    base.reaction_rate
  );
  let replyRate = normalizeSokratesReplyRate(
    source.reply_rate ?? source.replyRate,
    base.reply_rate
  );

  const legacyAllowText = normalizeBooleanFlag(source.allow_text, base.allow_text);
  const legacyAllowReactions = normalizeBooleanFlag(source.allow_reactions, base.allow_reactions);
  if (source.allowText !== undefined) {
    replyRate = normalizeBooleanFlag(source.allowText, true) ? replyRate : 'off';
  }
  if (source.allowReactions !== undefined && !normalizeBooleanFlag(source.allowReactions, true)) {
    reactionRate = 'off';
  }

  if (!hasExplicitRates) {
    const legacyProbability = Math.max(
      0,
      Math.min(0.25, Number(source.probability || legacyPreset.probability) || legacyPreset.probability)
    );
    const legacyReactionShare = Math.max(
      0,
      Math.min(1, Number(source.reaction_share || 0.7) || 0.7)
    );
    const legacyTextShareRaw = Number(source.text_share || (1 - legacyReactionShare));
    const legacyTextShare = Math.max(0, Math.min(1, Number.isFinite(legacyTextShareRaw) ? legacyTextShareRaw : (1 - legacyReactionShare)));
    const reactionProbability = legacyAllowReactions ? legacyProbability * legacyReactionShare : 0;
    const replyProbability = legacyAllowText ? legacyProbability * legacyTextShare : 0;
    reactionRate = deriveSokratesRateFromProbability(reactionProbability, { kind: 'reaction', fallback: base.reaction_rate });
    replyRate = normalizeSokratesReplyRate(
      deriveSokratesRateFromProbability(replyProbability, { kind: 'reply', fallback: base.reply_rate }),
      base.reply_rate
    );
    if (!legacyAllowReactions) {
      reactionRate = 'off';
    }
    if (!legacyAllowText) {
      replyRate = 'off';
    }
  } else {
    if (source.allow_text !== undefined && !legacyAllowText) {
      replyRate = 'off';
    }
    if (source.allow_reactions !== undefined && !legacyAllowReactions) {
      reactionRate = 'off';
    }
  }

  const reactionProbability = SOKRATES_SERVER_REACTION_RATE_PROBABILITIES[reactionRate] ?? 0;
  const replyProbability = SOKRATES_SERVER_REPLY_RATE_PROBABILITIES[replyRate] ?? 0;
  const combinedProbability = Math.min(0.25, reactionProbability + replyProbability);
  const reactionShare = combinedProbability > 0
    ? (reactionProbability / combinedProbability)
    : 0;
  const textShare = combinedProbability > 0
    ? (replyProbability / combinedProbability)
    : 0;
  const presetKey = resolveSokratesServerPreset(
    source.probability_preset,
    deriveSokratesPresetFromProbability(combinedProbability, base.probability_preset)
  );
  const preset = SOKRATES_SERVER_PROBABILITY_PRESETS[presetKey];
  const channelCooldownMs = Math.max(
    60000,
    Math.min(
      15 * 60 * 1000,
      Number(source.channel_cooldown_ms || preset.channelCooldownMs) || preset.channelCooldownMs
    )
  );
  const serverHourCap = Math.max(
    1,
    Math.min(60, Number(source.server_hour_cap || preset.serverHourCap) || preset.serverHourCap)
  );
  const providerUnavailableBehavior = String(
    source.provider_unavailable_behavior || source.providerUnavailableBehavior || base.provider_unavailable_behavior
  ).trim().toLowerCase();
  const normalizedProviderUnavailableBehavior = ['silent', 'notify'].includes(providerUnavailableBehavior)
    ? providerUnavailableBehavior
    : base.provider_unavailable_behavior;

  return {
    enabled: normalizeBooleanFlag(source.enabled, base.enabled),
    reaction_rate: reactionRate,
    reply_rate: replyRate,
    provider_unavailable_behavior: normalizedProviderUnavailableBehavior,
    allow_text: replyRate !== 'off',
    allow_reactions: reactionRate !== 'off',
    channel_scope: channelScope,
    channels_allowlist: channelScope === 'selected'
      ? normalizeIdList(source.channels_allowlist, channelIds)
      : [],
    reaction_pool: normalizeSokratesServerReactionPool(source.reaction_pool),
    probability_preset: presetKey,
    probability: combinedProbability,
    reaction_share: reactionShare,
    text_share: textShare,
    channel_cooldown_ms: channelCooldownMs,
    server_hour_cap: serverHourCap,
    ignore_bots: normalizeBooleanFlag(source.ignore_bots, base.ignore_bots),
    min_message_length: Math.max(1, Math.min(48, Number(source.min_message_length || base.min_message_length) || base.min_message_length))
  };
}

function buildSokratesServerAppView(installation, textChannels = []) {
  const channelIds = textChannels.map((channel) => Number(channel.id || 0)).filter(Boolean);
  const settings = normalizeSokratesServerSettings(installation?.settings || null, { channelIds });
  return {
    app_id: SOKRATES_SERVER_APP_ID,
    installed: Boolean(installation),
    installed_at: installation?.installed_at || '',
    settings
  };
}

function parseSokratesServerTestPlan(body) {
  if (!isDevMode()) {
    return null;
  }

  const raw = body?.sokratesServerTestPlan;
  if (!raw) {
    return null;
  }

  try {
    const parsed = typeof raw === 'object' && raw !== null
      ? raw
      : JSON.parse(String(raw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const forceAction = ['reaction', 'text', 'none'].includes(String(parsed.forceAction || '').trim().toLowerCase())
      ? String(parsed.forceAction).trim().toLowerCase()
      : '';
    return {
      forceAction,
      emoji: String(parsed.emoji || '').trim().slice(0, 32),
      providerTestPlan: parsed.providerTestPlan && typeof parsed.providerTestPlan === 'object'
        ? parsed.providerTestPlan
        : null
    };
  } catch (_error) {
    return null;
  }
}

function isSokratesServerChannelAllowed(settings, channelId) {
  if (!settings || settings.channel_scope !== 'selected') {
    return true;
  }
  return settings.channels_allowlist.includes(Number(channelId || 0));
}

function parseSqliteTimestampMs(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return 0;
  }
  const normalized = raw.includes('T')
    ? raw
    : `${raw.replace(' ', 'T')}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toSqliteTimestamp(ms) {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

function getSokratesServerCooldownState(serverId, channelId, settings, now = Date.now()) {
  const lastChannelAction = parseSqliteTimestampMs(
    getLatestServerAppActivity(serverId, SOKRATES_SERVER_APP_ID, channelId)
  );
  if (lastChannelAction) {
    const channelCooldownMs = Math.max(60000, Number(settings?.channel_cooldown_ms || 0));
    const nextAllowedAt = lastChannelAction + channelCooldownMs;
    if (nextAllowedAt > now) {
      return {
        blocked: true,
        retryAfterMs: nextAllowedAt - now
      };
    }
  }

  const serverHourCap = Math.max(1, Number(settings?.server_hour_cap || 1));
  const hourCount = countServerAppActivitySince(
    serverId,
    SOKRATES_SERVER_APP_ID,
    toSqliteTimestamp(now - (60 * 60 * 1000))
  );
  if (hourCount >= serverHourCap) {
    return {
      blocked: true,
      retryAfterMs: 60 * 1000
    };
  }

  return {
    blocked: false,
    retryAfterMs: 0
  };
}

function hasSokratesServerCooldown(serverId, channelId, settings, now = Date.now()) {
  return getSokratesServerCooldownState(serverId, channelId, settings, now).blocked;
}

function recordSokratesServerAction(serverId, channelId) {
  return recordServerAppActivity({
    serverId,
    channelId,
    appId: SOKRATES_SERVER_APP_ID,
    actionType: 'trigger'
  });
}

function getAiTransientFailureNotice(key) {
  const notice = aiTransientFailureNotices.get(key);
  if (!notice) {
    return null;
  }
  if (Number(notice.until || 0) <= Date.now()) {
    aiTransientFailureNotices.delete(key);
    return null;
  }
  return notice;
}

function rememberAiTransientFailureNotice(key, messageId, waitMs) {
  aiTransientFailureNotices.set(key, {
    messageId: Number(messageId || 0),
    until: Date.now() + Math.max(1000, Number(waitMs || 0))
  });
}

function chooseSokratesServerAction(settings, testPlan = null) {
  const forced = String(testPlan?.forceAction || '').trim().toLowerCase();
  if (forced === 'none') {
    return null;
  }
  if (forced === 'reaction') {
    return settings.allow_reactions
      ? { type: 'reaction', emoji: String(testPlan?.emoji || settings.reaction_pool[0] || '🤔') }
      : null;
  }
  if (forced === 'text') {
    return settings.allow_text ? { type: 'text' } : null;
  }

  if (Math.random() > Number(settings?.probability || 0)) {
    return null;
  }

  const canReaction = Boolean(settings?.allow_reactions);
  const canText = Boolean(settings?.allow_text);
  if (!canReaction && !canText) {
    return null;
  }
  if (canReaction && !canText) {
    return { type: 'reaction', emoji: settings.reaction_pool[0] || '🤔' };
  }
  if (!canReaction && canText) {
    return { type: 'text' };
  }

  if (Math.random() <= Number(settings?.reaction_share || 0.7)) {
    const pool = Array.isArray(settings?.reaction_pool) && settings.reaction_pool.length
      ? settings.reaction_pool
      : SOKRATES_SERVER_DEFAULT_REACTION_POOL;
    return {
      type: 'reaction',
      emoji: pool[Math.floor(Math.random() * pool.length)] || '🤔'
    };
  }

  return { type: 'text' };
}

function sanitizeSokratesServerReply(text) {
  const compact = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!compact) {
    return '';
  }

  const sentences = compact
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 3);
  const joined = sentences.join(' ').slice(0, 280).trim();
  if (!joined || /^ich bin (?:eine|ein) ai/i.test(joined) || /^(als ai|ich als ai)/i.test(joined)) {
    return '';
  }
  return joined;
}

function logSokratesServerSilentFailure({ serverId, channelId, messageId, error }) {
  const reason = error instanceof SokratesServiceError
    ? String(error.code || 'PROVIDER_ERROR')
    : String(error?.code || error?.name || 'UNKNOWN');
  console.warn(JSON.stringify({
    event: 'sokrates_server_reaction_failed',
    ts: new Date().toISOString(),
    server_id: Number(serverId || 0),
    channel_id: Number(channelId || 0),
    message_id: Number(messageId || 0),
    reason_code: reason
  }));
}

function mapGifPickerItem(item, currentUserId) {
  return {
    id: Number(item.id || 0),
    name: String(item.name || ''),
    tags: String(item.tags || ''),
    description: String(item.description || ''),
    mime_type: String(item.mime_type || 'image/gif'),
    file_size: Number(item.file_size || 0),
    url: String(item.url || ''),
    previewUrl: String(item.url || ''),
    owner_id: Number(item.owner_id || 0),
    owner_display_name: String(item.owner_display_name || ''),
    owner_username: String(item.owner_username || ''),
    usage_count: Number(item.usage_count || 0),
    created_at: item.created_at,
    source: Number(item.owner_id || 0) === Number(currentUserId || 0) ? 'mine' : 'global'
  };
}

function orderGifPickerItemsByIds(ids, rows, currentUserId) {
  const byId = new Map(rows.map((row) => [Number(row.id || 0), mapGifPickerItem(row, currentUserId)]));
  return ids
    .map((id) => byId.get(Number(id)))
    .filter(Boolean);
}

function gifMatchesPickerQuery(item, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return [
    item.name,
    item.tags,
    item.description,
    item.owner_display_name,
    item.owner_username
  ].some((value) => String(value || '').toLowerCase().includes(needle));
}

function buildGifPickerPayload(userId, query = '') {
  const q = String(query || '').trim();
  const state = getGifPickerState(userId);
  const allItems = listGlobalGifAssets({ query: q, limit: MAX_GIF_PICKER_RESULTS })
    .map((row) => mapGifPickerItem(row, userId));
  const mineItems = allItems.filter((item) => item.owner_id === Number(userId || 0));
  const globalItems = allItems.filter((item) => item.owner_id !== Number(userId || 0));
  const favoriteItems = orderGifPickerItemsByIds(state.favorites, listGlobalGifsByIds(state.favorites), userId)
    .filter((item) => gifMatchesPickerQuery(item, q));
  const recentItems = orderGifPickerItemsByIds(
    state.recents.filter((id) => !state.favorites.includes(id)),
    listGlobalGifsByIds(state.recents),
    userId
  ).filter((item) => gifMatchesPickerQuery(item, q));
  const seenIds = new Set([...favoriteItems, ...recentItems].map((item) => item.id));
  const trendingItems = q
    ? []
    : globalItems
      .filter((item) => !seenIds.has(item.id))
      .slice(0, 16);

  const sections = [];
  if (favoriteItems.length) {
    sections.push({ id: 'favorites', label: 'Favorites', items: favoriteItems });
  }
  if (recentItems.length) {
    sections.push({ id: 'recent', label: 'Recent', items: recentItems });
  }
  if (trendingItems.length) {
    sections.push({ id: 'trending', label: 'Trending', items: trendingItems });
  }
  if (globalItems.length) {
    sections.push({ id: 'global', label: 'Global Library', items: globalItems });
  }
  if (mineItems.length) {
    sections.push({ id: 'mine', label: 'My Uploads', items: mineItems });
  }

  return {
    sections,
    state
  };
}

function isDevMode() {
  return String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production';
}

function cleanupAiTraceStore(now = Date.now()) {
  for (const [traceId, entry] of aiTraceStore.entries()) {
    if (!entry || Number(entry.expiresAt || 0) <= now) {
      aiTraceStore.delete(traceId);
    }
  }
}

function getHttpReason(status) {
  return HTTP_STATUS_REASONS[Number(status) || 500] || 'Error';
}

function normalizePresenceStatus(value) {
  if (['online', 'idle', 'dnd', 'streaming'].includes(String(value || '').toLowerCase())) {
    return String(value).toLowerCase();
  }
  return 'offline';
}

function getPresenceLabel(status) {
  const normalized = normalizePresenceStatus(status);
  if (normalized === 'idle') {
    return 'abwesend';
  }
  if (normalized === 'dnd') {
    return 'nicht stören';
  }
  if (normalized === 'streaming') {
    return 'streaming';
  }
  return normalized;
}

function resolveActiveCustomStatus(profile) {
  if (!profile) {
    return {
      custom_status_emoji: '',
      custom_status_text: '',
      custom_status_expires_at: null,
      custom_status_expiry: null,
      custom_status_active: false,
      custom_status_line: ''
    };
  }

  const emoji = String(profile.custom_status_emoji || '').trim();
  const text = String(profile.custom_status_text || '').trim();
  const expiresAt = String(profile.custom_status_expiry || profile.custom_status_expires_at || '').trim();
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : 0;
  const isExpired = Boolean(expiresAt) && Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
  const isActive = !isExpired && Boolean(emoji || text);
  const line = isActive
    ? [emoji, text].filter(Boolean).join(' ').trim()
    : '';

  return {
    custom_status_emoji: isActive ? emoji : '',
    custom_status_text: isActive ? text : '',
    custom_status_expires_at: isActive ? expiresAt : null,
    custom_status_expiry: isActive ? expiresAt : null,
    custom_status_active: isActive,
    custom_status_line: line
  };
}

function applyVisualFixtureProfile(username, {
  status = 'online',
  emoji = '',
  text = ''
} = {}) {
  const baseUser = findUserByUsername(username);
  if (!baseUser) {
    return null;
  }

  const profile = findUserProfileById(baseUser.id);
  if (!profile) {
    return null;
  }

  const safeStatus = status === 'offline'
    ? 'invisible'
    : (status === 'streaming' ? 'online' : status);
  const liveStatus = status === 'offline' ? 'invisible' : status;
  updateUserProfileSettings(profile.id, {
    displayName: profile.display_name,
    aboutMe: profile.about_me || '',
    avatarUrl: profile.avatar_url || '',
    bannerUrl: profile.banner_url || '',
    presenceStatus: safeStatus,
    customStatusEmoji: emoji,
    customStatusText: text,
    customStatusExpiresAt: null
  });

  if (status === 'offline') {
    markDisconnected(profile.id, { manualStatus: 'invisible' });
  } else {
    touchHeartbeat(profile.id, {
      manualStatus: liveStatus,
      clientIdle: liveStatus === 'idle'
    });
  }

  return profile.id;
}

function applyDmVisualFixtureState(actorUserId) {
  const fixtureUsers = [
    { username: 'euler', status: 'online', emoji: '🔥', text: 'Reviewing tensors' },
    { username: 'platon', status: 'idle', emoji: '📚', text: 'In der Akademie' },
    { username: 'lovelace', status: 'dnd', emoji: '', text: 'Compiling quietly' },
    { username: 'curie', status: 'offline', emoji: '', text: '' },
    { username: 'bohr', status: 'streaming', emoji: '', text: '' }
  ];

  const directThreadIds = {};
  fixtureUsers.forEach((fixtureUser) => {
    const userId = applyVisualFixtureProfile(fixtureUser.username, fixtureUser);
    if (!userId) {
      return;
    }
    directThreadIds[fixtureUser.username] = createDirectThread(actorUserId, userId);
  });

  touchHeartbeat(actorUserId, {
    manualStatus: 'online',
    clientIdle: false
  });

  const aiThreadId = ensureSokratesThreadForUser(actorUserId);
  return {
    focusThreadId: directThreadIds.euler || aiThreadId || null,
    threadIds: {
      ...directThreadIds,
      ai: aiThreadId
    }
  };
}

function applyPresenceToProfile(profile) {
  if (!profile) {
    return null;
  }

  const subjectUserId = Number(profile.user_id || profile.id || 0);
  const livePresence = getEffectivePresence(subjectUserId, profile.presence_status);
  const status = normalizePresenceStatus(livePresence.status);
  return {
    ...profile,
    user_id: subjectUserId,
    presence: status,
    presence_label: getPresenceLabel(status),
    last_seen: livePresence.last_seen
  };
}

function applyPresenceToCollection(items = []) {
  return items.map((item) => applyPresenceToProfile(item));
}

function applyPresenceToMessage(message) {
  if (!message) {
    return null;
  }

  const authorId = Number(message.author_id || 0);
  const livePresence = getEffectivePresence(authorId, message.author_presence_status || message.author_presence || 'offline');
  const status = normalizePresenceStatus(livePresence.status);
  return {
    ...message,
    author_presence: status,
    author_last_seen: livePresence.last_seen
  };
}

function applyPresenceToMessages(items = []) {
  return items.map((item) => applyPresenceToMessage(item));
}

function getHydratedMessageById(messageId) {
  return applyPresenceToMessage(getMessageById(messageId));
}

function buildEmptyAboutPlusDefaults() {
  return { fields: [] };
}

function buildAboutPlusDefaults(overrides = {}) {
  const definitionByKey = new Map(ABOUT_PLUS_FIELD_DEFINITIONS.map((field) => [field.key, field]));
  const fields = Object.entries(overrides || {}).reduce((acc, [key, value], index) => {
    const definition = definitionByKey.get(key);
    if (!definition) {
      return acc;
    }
    const source = value && typeof value === 'object' ? value : {};
    acc.push({
      id: `template:${key}`,
      key: `template:${key}`,
      template_key: key,
      type: definition.type,
      kind: definition.kind,
      label: String(source.label || definition.label).trim() || definition.label,
      value: source.value,
      visible: source.visible !== false,
      order: Number(source.order ?? index),
      icon: String(source.icon || '').trim(),
      media: source.media && typeof source.media === 'object' ? { ...source.media } : {},
      privacy: source.privacy === 'private' ? 'private' : (source.privacy === 'friends' ? 'friends' : 'public'),
      show_in_full_profile: source.show_in_full_profile !== false,
      show_in_mini_profile: source.show_in_mini_profile === true,
      show_in_dm_info_sidebar: source.show_in_dm_info_sidebar === true
    });
    return acc;
  }, []);

  return { fields };
}

function buildDefaultAboutPlus(profile) {
  const username = profile?.is_system_agent
    ? 'sokrates'
    : String(profile?.username || '').toLowerCase();
  const defaultsByUser = {
    sokrates: buildAboutPlusDefaults({
      favorite_food: { value: 'Brot, Oliven, Ziegenkäse.', visible: true },
      favorite_color: { value: '#C2B280', visible: true },
      favorite_game: { value: 'Disco Elysium', visible: true },
      favorite_music: { value: 'Kithara-Hymnen (Apollo)', visible: true },
      favorite_book: { value: '', visible: true },
      favorite_quote: { value: { text: 'Lieber Unrecht leiden als Unrecht tun.', source: '' }, visible: true },
      dislikes: { value: [], visible: true },
      bio: {
        value: 'Athener Bürger, Fragender von Berufung. Ich prüfe Definitionen, zerlege Behauptungen, suche Widersprüche und führe zurück zum Kern: Was ist Tugend, was ist gutes Leben, was folgt logisch daraus.',
        visible: true
      }
    }),
    einstein: buildAboutPlusDefaults({
      favorite_food: { value: 'Kaffee und Gedankenspiele', visible: true },
      favorite_color: { value: '#d6b866', visible: true },
      favorite_game: { value: 'Gedankenexperiment', visible: true },
      favorite_music: { value: 'Mozart', visible: true },
      favorite_book: { value: 'Relativity', visible: true },
      favorite_quote: { value: { text: 'Phantasie ist wichtiger als Wissen.', source: '' }, visible: true },
      bio: { value: 'Ich mag Modelle, die auch unter Druck elegant bleiben.', visible: true }
    }),
    platon: buildAboutPlusDefaults({
      favorite_food: { value: 'Oliven und lange Gesprache', visible: true },
      favorite_color: { value: '#6c7bff', visible: true },
      favorite_game: { value: 'Dialektischer Schlagabtausch', visible: true },
      favorite_music: { value: 'Leiermusik', visible: true },
      favorite_book: { value: 'Politeia', visible: true },
      favorite_quote: { value: { text: 'Die Form der guten UI muss erst gedacht werden.', source: '' }, visible: true },
      bio: { value: 'Zwischen Ideenlehre und Chat-Layouts suche ich noch immer das Ideal.', visible: true }
    })
  };

  return defaultsByUser[username] || buildAboutPlusDefaults();
}

function normalizeAboutPlusTextValue(value, maxLength = 1200) {
  return String(value ?? '').trim().slice(0, Math.max(1, Number(maxLength || 1200)));
}

function normalizeAboutPlusListValue(value, maxLength = 480) {
  const items = Array.isArray(value)
    ? value
    : String(value ?? '')
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((item) => item.slice(0, Math.max(1, Number(maxLength || 480))));
}

function normalizeAboutPlusQuoteValue(value, maxLength = 320) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : { text: value };
  return {
    text: normalizeAboutPlusTextValue(source.text, maxLength),
    source: normalizeAboutPlusTextValue(source.source, 160)
  };
}

function normalizeAboutPlusMediaValue(value, maxLength = 160) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
  return {
    file_url: normalizeAboutPlusTextValue(source.file_url || source.url || '', 2048),
    data_url: String(source.data_url || '').trim(),
    caption: normalizeAboutPlusTextValue(source.caption, maxLength)
  };
}

function normalizeAboutPlusMediaCardValue(value, maxLength = 160) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
  const legacyItem = normalizeAboutPlusMediaValue(source, maxLength);
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const items = (rawItems.length ? rawItems : [legacyItem])
    .map((item) => normalizeAboutPlusMediaValue(item, maxLength))
    .filter((item) => item.file_url || item.data_url || item.caption)
    .slice(0, 3);
  return {
    items
  };
}

function getAboutPlusMediaCardItems(value) {
  const normalized = normalizeAboutPlusMediaCardValue(value);
  return Array.isArray(normalized.items) ? normalized.items : [];
}

function normalizeAboutPlusFieldValue(value, definition) {
  if (!definition) {
    return normalizeAboutPlusTextValue(value, 1200);
  }
  if (definition.type === 'color') {
    const normalized = normalizeAboutPlusTextValue(value, definition.max_length || 7);
    return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : '';
  }
  if (definition.type === 'quote') {
    return normalizeAboutPlusQuoteValue(value, definition.max_length || 320);
  }
  if (definition.type === 'list') {
    return normalizeAboutPlusListValue(value, definition.max_length || 480);
  }
  if (definition.type === 'media_card') {
    return normalizeAboutPlusMediaCardValue(value, definition.max_length || 160);
  }
  return normalizeAboutPlusTextValue(value, definition.max_length || 1200);
}

function normalizeAboutPlusField(raw, index = 0, fallback = null) {
  const definition = ABOUT_PLUS_FIELD_DEFINITIONS.find((entry) => entry.key === String(raw?.template_key || fallback?.template_key || raw?.key || '').trim()) || ABOUT_PLUS_FIELD_DEFINITIONS.find((entry) => entry.key === String(fallback?.template_key || '').trim()) || null;
  const source = raw && typeof raw === 'object' ? raw : {};
  const fallbackSource = fallback && typeof fallback === 'object' ? fallback : {};
  const templateKey = String(source.template_key || fallbackSource.template_key || definition?.key || '').trim();
  const id = String(source.id || fallbackSource.id || source.key || fallbackSource.key || `custom:${index}`).trim() || `custom:${index}`;
  const type = ['text_short', 'text_long', 'color', 'quote', 'list', 'media_card'].includes(String(source.type || fallbackSource.type || definition?.type || 'text_short'))
    ? String(source.type || fallbackSource.type || definition?.type || 'text_short')
    : 'text_short';
  const maxLength = Number(definition?.max_length || fallbackSource.max_length || 1200);
  const normalizedValue = normalizeAboutPlusFieldValue(
    source.value !== undefined ? source.value : fallbackSource.value,
    {
      ...(definition || {}),
      type,
      max_length: maxLength
    }
  );

  const media = definition?.supports_image
    ? normalizeAboutPlusMediaValue(source.media || fallbackSource.media || {
      file_url: source.image_url || fallbackSource.image_url || '',
      data_url: source.image_data || '',
      caption: ''
    }, maxLength)
    : (type === 'media_card'
      ? {}
      : {});

  return {
    id,
    key: templateKey || id,
    template_key: templateKey,
    type,
    kind: String(source.kind || fallbackSource.kind || definition?.kind || 'text').trim() || 'text',
    label: normalizeAboutPlusTextValue(source.label || fallbackSource.label || definition?.label || 'Custom Field', 80) || 'Custom Field',
    value: normalizedValue,
    visible: source.visible !== undefined ? source.visible !== false : (fallbackSource.visible !== false),
    order: Number(source.order ?? fallbackSource.order ?? index),
    display_mode: String(source.display_mode || fallbackSource.display_mode || (source.show_in_mini_profile === true || fallbackSource.show_in_mini_profile === true ? 'mini' : 'full')).trim().toLowerCase() === 'mini'
      ? 'mini'
      : 'full',
    icon: normalizeAboutPlusTextValue(source.icon || fallbackSource.icon || '', 24),
    media,
    privacy: source.privacy === 'private' ? 'private' : (source.privacy === 'friends' ? 'friends' : (fallbackSource.privacy === 'private' ? 'private' : (fallbackSource.privacy === 'friends' ? 'friends' : 'public'))),
    show_in_full_profile: true,
    show_in_mini_profile: String(source.display_mode || fallbackSource.display_mode || '').trim().toLowerCase() === 'mini'
      || source.show_in_mini_profile === true
      || fallbackSource.show_in_mini_profile === true,
    show_in_dm_info_sidebar: source.show_in_dm_info_sidebar === true || fallbackSource.show_in_dm_info_sidebar === true,
    editor_type: String(definition?.editor_type || fallbackSource.editor_type || 'text'),
    editor_rows: Number(definition?.editor_rows || fallbackSource.editor_rows || 0),
    max_length: maxLength
  };
}

function isAboutPlusFieldEmpty(field) {
  const type = String(field?.type || 'text_short');
  if (type === 'color') {
    return !String(field?.value || '').trim();
  }
  if (type === 'quote') {
    const text = String(field?.value?.text || '').trim();
    const compact = text.toLowerCase().replace(/\.+$/, '');
    return !text || text === '-' || compact === 'nicht angegeben';
  }
  if (type === 'list') {
    return !Array.isArray(field?.value) || field.value.length === 0;
  }
  if (type === 'media_card') {
    return getAboutPlusMediaCardItems(field?.value).length === 0;
  }
  const normalized = String(field?.value ?? '').trim();
  const compact = normalized.toLowerCase().replace(/\.+$/, '');
  return !normalized || normalized === '-' || compact === 'nicht angegeben';
}

function normalizeAboutPlusPayload(raw, defaults = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const defaultFields = Array.isArray(defaults?.fields) ? defaults.fields : [];
  const fallbackById = new Map(defaultFields.map((field) => [String(field.id || field.key || ''), field]));
  const fallbackByTemplate = new Map(defaultFields.map((field) => [String(field.template_key || ''), field]));

  if (Array.isArray(source.fields)) {
    return {
      fields: source.fields
        .map((field, index) => normalizeAboutPlusField(
          field,
          index,
          fallbackById.get(String(field?.id || field?.key || '')) || fallbackByTemplate.get(String(field?.template_key || '')) || null
        ))
        .sort((a, b) => a.order - b.order)
    };
  }

  const legacyEntries = [];
  ABOUT_PLUS_FIELD_DEFINITIONS.forEach((definition, index) => {
    const fallback = fallbackByTemplate.get(definition.key) || null;
    const legacy = source?.[definition.key];
    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
      legacyEntries.push(normalizeAboutPlusField({
        id: fallback?.id || `template:${definition.key}`,
        template_key: definition.key,
        label: fallback?.label || definition.label,
        visible: legacy.visibility !== 'private',
        value: definition.supports_image
          ? (legacy.value ?? '')
          : legacy.value,
        media: definition.supports_image
          ? { file_url: legacy.image_url || '', data_url: legacy.image_data || '', caption: '' }
          : (fallback?.media || {})
      }, index, fallback));
      return;
    }

    if (fallback) {
      legacyEntries.push(normalizeAboutPlusField(fallback, index, fallback));
    }
  });

  return {
    fields: legacyEntries.sort((a, b) => a.order - b.order)
  };
}

function buildAboutPlusForViewer(viewerId, profile) {
  const defaults = buildDefaultAboutPlus(profile);
  const stored = profile.is_system_agent
    ? normalizeAboutPlusPayload(defaults, defaults)
    : normalizeAboutPlusPayload(getUserProfileExtras(profile.id), defaults);
  const isOwner = Number(viewerId || 0) === Number(profile.id || 0);
  const orderedFields = (Array.isArray(stored.fields) ? stored.fields : [])
    .map((field, index) => normalizeAboutPlusField(field, index, field))
    .sort((a, b) => a.order - b.order);
  const safeFields = isOwner
    ? orderedFields
    : orderedFields.filter((field) => field.privacy !== 'private');
  const visibleFields = safeFields.filter((field) => (
    field.visible !== false
    && field.show_in_full_profile !== false
    && !isAboutPlusFieldEmpty(field)
  ));

  return {
    editable: isOwner && !profile.is_system_agent,
    can_view_private: isOwner,
    fields: safeFields,
    visible_fields: visibleFields,
    templates: ABOUT_PLUS_FIELD_DEFINITIONS.map((definition) => ({
      key: definition.key,
      label: definition.label,
      type: definition.type,
      kind: definition.kind,
      supports_image: Boolean(definition.supports_image)
    }))
  };
}

function decorateProfileForView(profile) {
  if (!profile) {
    return null;
  }

  const resolvedAssets = resolveProfileAssets(profile);
  const customStatus = resolveActiveCustomStatus(profile);
  return {
    ...profile,
    ...customStatus,
    ...resolvedAssets
  };
}

async function attachFavoriteGameCoverToAboutPlusFields(userId, fields = []) {
  const nextFields = Array.isArray(fields)
    ? fields.map((field) => ({ ...field }))
    : [];
  const favoriteGameIndex = nextFields.findIndex((field) => String(field?.template_key || '').trim() === 'favorite_game');
  if (favoriteGameIndex < 0) {
    return nextFields;
  }

  const favoriteGameField = nextFields[favoriteGameIndex];
  const gameName = String(favoriteGameField?.value || '').trim();
  const currentMedia = favoriteGameField?.media && typeof favoriteGameField.media === 'object'
    ? favoriteGameField.media
    : { file_url: '', data_url: '', caption: '' };

  if (!normalizeGameTitle(gameName)) {
    nextFields[favoriteGameIndex] = normalizeAboutPlusField({
      ...favoriteGameField,
      media: {
        ...currentMedia,
        file_url: '',
        data_url: '',
        caption: ''
      }
    }, favoriteGameIndex, favoriteGameField);
    return nextFields;
  }

  const cacheEntry = findGameCoverCacheByName(normalizeGameTitle(gameName));
  const cover = await resolveFavoriteGameCover({
    gameName,
    userId,
    cachedEntry: cacheEntry,
    saveCacheEntry: upsertGameCoverCache
  });

  const nextMedia = cover.media
    ? {
      ...currentMedia,
      file_url: String(cover.media.file_url || '').trim(),
      data_url: '',
      caption: ''
    }
    : {
      ...currentMedia,
      file_url: '',
      data_url: '',
      caption: ''
    };

  nextFields[favoriteGameIndex] = normalizeAboutPlusField({
    ...favoriteGameField,
    media: nextMedia
  }, favoriteGameIndex, favoriteGameField);

  return nextFields;
}

function persistProfileDataUrlAsset(dataUrl, {
  userId,
  kind = 'avatar',
  allowVideo = false,
  maxBytes = PROFILE_PHOTO_MAX_BYTES
} = {}) {
  if (!isDataUrl(dataUrl)) {
    return String(dataUrl || '').trim();
  }

  const normalizedKind = String(kind || 'asset').trim() || 'asset';
  return writeDataUrlToUploads({
    dataUrl,
    userId,
    subdir: normalizedKind === 'photo' ? 'profile-media' : 'profile-assets',
    prefix: normalizedKind,
    allowedMimeTypes: allowVideo ? PHOTO_MIME_TYPES : IMAGE_MIME_TYPES,
    maxBytes
  });
}

function persistServerDataUrlAsset(dataUrl, {
  serverId,
  kind = 'icon',
  maxBytes = SERVER_BANNER_MAX_BYTES
} = {}) {
  if (!isDataUrl(dataUrl)) {
    return String(dataUrl || '').trim();
  }

  const normalizedKind = String(kind || 'asset').trim().toLowerCase() === 'icon' ? 'icon' : 'banner';
  return writeDataUrlToUploads({
    dataUrl,
    userId: Number(serverId || 0),
    subdir: 'server-assets',
    prefix: normalizedKind,
    allowedMimeTypes: IMAGE_MIME_TYPES,
    maxBytes
  });
}

function normalizeServerSettingsSection(value) {
  const section = String(value || '').trim().toLowerCase();
  return SERVER_SETTINGS_SECTIONS.includes(section) ? section : 'overview';
}

function applyPresenceToVoiceParticipant(participant) {
  if (!participant) {
    return null;
  }

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
  return channels.map((channel) => ({
    ...channel,
    participants: Array.isArray(channel.participants)
      ? channel.participants.map((participant) => applyPresenceToVoiceParticipant(participant))
      : []
  }));
}

function buildFullProfilePayload(viewerId, profile) {
  const hydrated = applyPresenceToProfile(profile);
  if (!hydrated) {
    return null;
  }

  const isAiProfile = Boolean(hydrated.is_system_agent);
  if (isAiProfile) {
    const sokratesAgent = ensureSokratesAgentUser();
    if (Number(hydrated.id || 0) !== Number(sokratesAgent.id || 0)) {
      return null;
    }
  }

  const viewProfile = decorateProfileForView({
    ...hydrated,
    display_name: isAiProfile ? SOKRATES_DISPLAY_NAME : hydrated.display_name,
    about_me: isAiProfile ? SOKRATES_ABOUT_ME : (hydrated.about_me || '')
  });
  const isOwner = Number(viewerId || 0) === Number(hydrated.id || 0);
  const mutualServers = listMutualServers(viewerId, hydrated.id, 12);
  const mutualFriends = applyPresenceToCollection(listMutualFriends(viewerId, hydrated.id, 12))
    .map((friend) => decorateProfileForView(friend));
  const visibleMutualServers = isAiProfile ? [] : mutualServers;
  const visibleMutualFriends = isAiProfile ? [] : mutualFriends;
  const photos = listUserProfileMedia(hydrated.id, viewerId, PROFILE_PHOTO_MAX_ITEMS).map((item) => ({
    id: item.id,
    title: item.title || '',
    file_url: String(item.file_url || '').trim(),
    mime_type: String(item.mime_type || '').trim(),
    visibility: item.visibility === 'private' ? 'private' : 'public',
    effect_name: item.effect_name || 'none',
    created_at: item.created_at || ''
  }));
  const aboutPlus = buildAboutPlusForViewer(viewerId, hydrated);
  const tabs = isAiProfile
    ? [
      { id: 'photos', label: 'Photos' },
      { id: 'about_plus', label: 'About+' },
      { id: 'capabilities', label: 'Capabilities' }
    ]
    : [
      { id: 'photos', label: 'Photos' },
      { id: 'about_plus', label: 'About+' },
      { id: 'friends', label: `Mutual Friends (${countMutualFriends(viewerId, hydrated.id)})` },
      { id: 'servers', label: `Mutual Servers (${countMutualServers(viewerId, hydrated.id)})` }
    ];

  return {
    ok: true,
    profile: {
      id: viewProfile.id,
      username: viewProfile.username,
      display_name: viewProfile.display_name,
      about_me: viewProfile.about_me || '',
      avatar_url: viewProfile.avatar_url || '',
      avatar_fallback_url: viewProfile.avatar_fallback_url || '',
      banner_url: viewProfile.banner_url || '',
      banner_fallback_url: viewProfile.banner_fallback_url || '',
      created_at: viewProfile.created_at || '',
      presence: isAiProfile ? 'online' : viewProfile.presence,
      presence_label: isAiProfile ? 'AI DM • online' : viewProfile.presence_label,
      last_seen: viewProfile.last_seen,
      is_ai_dm: isAiProfile,
      is_owner: isOwner,
      badge_label: isAiProfile ? 'AI DM' : ''
    },
    actions: isAiProfile
      ? [
        { id: 'close', label: 'Back to DM', variant: 'btn', close_only: true },
        { id: 'badge', label: 'AI DM', variant: 'chip', disabled: true }
      ]
      : (isOwner
        ? [
          { id: 'close', label: 'Close', variant: 'btn', close_only: true },
          { id: 'edit_about_plus', label: 'Edit Profile', variant: 'chip', action: 'edit-about-plus' }
        ]
        : [
          { id: 'close', label: 'Message', variant: 'btn', close_only: true },
          { id: 'add_friend', label: 'Add Friend', variant: 'chip', disabled: true },
          { id: 'more', label: 'More', variant: 'chip', disabled: true }
        ]),
    tabs,
    default_tab: 'photos',
    photos,
    photo_upload: {
      enabled: isOwner && !isAiProfile,
      accepted_types: PHOTO_MIME_TYPES.join(','),
      max_items: PROFILE_PHOTO_MAX_ITEMS,
      max_bytes: PROFILE_PHOTO_MAX_BYTES
    },
    about_plus: aboutPlus,
    ai_profile: isAiProfile
      ? {
        discussion_mode_lines: [...SOKRATES_DISCUSSION_MODE_LINES],
        capabilities: [...SOKRATES_CAPABILITIES]
      }
      : null,
    mutual_friends_count: isAiProfile ? 0 : countMutualFriends(viewerId, hydrated.id),
    mutual_servers_count: isAiProfile ? 0 : countMutualServers(viewerId, hydrated.id),
    mutual_friends: visibleMutualFriends.map((friend) => ({
      id: friend.id,
      username: friend.username,
      display_name: friend.display_name,
      avatar_url: friend.avatar_url || '',
      avatar_fallback_url: friend.avatar_fallback_url || '',
      presence: friend.presence,
      presence_label: friend.presence_label,
      custom_status_line: friend.custom_status_line || ''
    })),
    mutual_servers: visibleMutualServers.map((server) => ({
      id: server.id,
      name: server.name,
      description: server.description || ''
    }))
  };
}

function buildJsonMessageActionError(res, status, error) {
  return res.status(status).json({
    ok: false,
    error
  });
}

function resolveReplyTargetForCompose({ replyToMessageId, threadId = 0, channelId = 0, actorId }) {
  const targetId = Number(replyToMessageId || 0);
  if (!targetId) {
    return { ok: true, replyToMessageId: null };
  }

  const context = findMessageActionContext(targetId);
  if (!context) {
    return { ok: false, code: 'reply_target_missing' };
  }

  if (threadId) {
    if (Number(context.thread_id || 0) !== Number(threadId) || !findThreadByIdForUser(threadId, actorId)) {
      return { ok: false, code: 'reply_target_invalid' };
    }
    return { ok: true, replyToMessageId: targetId };
  }

  if (channelId) {
    if (Number(context.channel_id || 0) !== Number(channelId)) {
      return { ok: false, code: 'reply_target_invalid' };
    }
    return { ok: true, replyToMessageId: targetId };
  }

  return { ok: false, code: 'reply_target_invalid' };
}

function buildAiErrorResponse(error, { requestId, idempotencyKey = '' }) {
  const providerAttempts = normalizeProviderAttempts(error);
  const status = Number(error?.status || 503);
  const payload = {
    ok: false,
    requestId,
    code: String(error?.code || 'PROVIDER_ERROR'),
    message: String(error?.message || 'Sokrates ist vorübergehend nicht verfügbar.'),
    status,
    reason: getHttpReason(status),
    retryable: error?.retryable !== false,
    provider: String(error?.provider || 'openai'),
    activeMode: String(error?.activeMode || 'auto'),
    fallbackReason: String(error?.fallbackReason || ''),
    finalProviderUsed: String(error?.finalProviderUsed || error?.provider || 'openai'),
    providerAttemptOrder: normalizeAiProviderAttemptOrder(
      error?.providerAttemptOrder,
      String(error?.provider || 'openai')
    ),
    providerErrors: normalizeAiProviderErrors(error),
    providerAttempts,
    final_provider_used: String(error?.finalProviderUsed || error?.provider || 'openai'),
    provider_attempt_order: normalizeAiProviderAttemptOrder(
      error?.providerAttemptOrder,
      String(error?.provider || 'openai')
    ),
    provider_errors: normalizeAiProviderErrors(error),
    provider_attempts: providerAttempts,
    final_outcome: String(error?.finalOutcome || 'HTTP_ERROR'),
    reason_if_in_character_error: String(error?.reasonIfInCharacterError || ''),
    is_fallback_used: Boolean(error?.usedFallback === true || String(error?.fallbackReason || '').trim())
  };

  if (idempotencyKey) {
    payload.idempotencyKey = String(idempotencyKey);
  }

  if (Number(error?.retryAfterMs || 0) > 0) {
    payload.retryAfterMs = Number(error.retryAfterMs);
  }

  if (isDevMode() && error?.detail) {
    payload.detail = String(error.detail);
  }

  return payload;
}

function buildAiErrorMeta(error) {
  const providerAttempts = normalizeProviderAttempts(error);
  const status = Number(error?.status || 503);
  const payload = {
    code: String(error?.code || 'PROVIDER_ERROR'),
    status,
    reason: getHttpReason(status),
    retryable: error?.retryable !== false,
    provider: String(error?.provider || 'openai'),
    activeMode: String(error?.activeMode || 'auto'),
    fallbackReason: String(error?.fallbackReason || ''),
    retryAfterMs: Number(error?.retryAfterMs || 0),
    finalProviderUsed: String(error?.finalProviderUsed || error?.provider || 'openai'),
    providerAttemptOrder: normalizeAiProviderAttemptOrder(
      error?.providerAttemptOrder,
      String(error?.provider || 'openai')
    ),
    providerErrors: normalizeAiProviderErrors(error),
    providerAttempts
  };
  payload.reasonIfInCharacterError = String(error?.reasonIfInCharacterError || '');
  payload.reason_if_in_character_error = String(error?.reasonIfInCharacterError || '');

  if (isDevMode() && error?.detail) {
    payload.detail = String(error.detail);
  }

  return payload;
}

function logAiReplyEvent(level, payload) {
  const line = JSON.stringify({
    event: 'sokrates.ai_reply',
    ts: new Date().toISOString(),
    ...payload
  });

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

function normalizeAiProviderAttemptOrder(order, fallbackProvider = 'openai') {
  if (Array.isArray(order) && order.length) {
    return order.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  const fallback = String(fallbackProvider || '').trim();
  return fallback ? [fallback] : [];
}

function normalizeAiProviderErrors(source) {
  if (!source || typeof source !== 'object') {
    return { openai: '', ollama: '' };
  }
  const raw = source.providerErrors && typeof source.providerErrors === 'object'
    ? source.providerErrors
    : null;
  return {
    openai: String(raw?.openai || ''),
    ollama: String(raw?.ollama || '')
  };
}

function normalizeProviderAttempts(source) {
  const raw = Array.isArray(source?.providerAttempts)
    ? source.providerAttempts
    : (Array.isArray(source?.provider_attempts) ? source.provider_attempts : []);
  if (!raw.length) {
    return [];
  }
  return raw.map((entry) => ({
    provider: String(entry?.provider || '').trim(),
    ok: entry?.ok === true,
    status: Number(entry?.status || 0),
    err_code: String(entry?.err_code || ''),
    latency_ms: Number(entry?.latency_ms || 0)
  }));
}

function buildAiTokenStats(usage) {
  if (!usage || typeof usage !== 'object') {
    return {
      prompt_tokens: null,
      response_tokens: null
    };
  }
  const promptTokens = Number(usage.prompt_tokens || usage.input_tokens || 0) || null;
  const responseTokens = Number(usage.completion_tokens || usage.output_tokens || 0) || null;
  return {
    prompt_tokens: promptTokens,
    response_tokens: responseTokens
  };
}

function persistAiTrace(res, payload) {
  if (!isDevMode() || !res || res.headersSent) {
    return '';
  }
  cleanupAiTraceStore();
  const traceId = nanoid(12);
  aiTraceStore.set(traceId, {
    ...payload,
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    expiresAt: Date.now() + AI_TRACE_TTL_MS
  });
  res.set('X-AI-Trace-Id', traceId);
  return traceId;
}

function sendAiAssistantMessage(res, {
  meta,
  message,
  provider,
  model = '',
  activeMode = 'auto',
  usedFallback = false,
  fallbackReason = '',
  aiError = null,
  providerAttemptOrder = null,
  providerErrors = null,
  finalProviderUsed = '',
  providerAttempts = null,
  usage = null,
  finalOutcome = ''
}) {
  const normalizedFinalProvider = String(finalProviderUsed || provider || 'openai');
  const normalizedProviderAttempts = normalizeProviderAttempts({ providerAttempts });
  const tokenStats = buildAiTokenStats(usage);
  const normalizedFinalOutcome = String(finalOutcome || (aiError ? 'IN_CHARACTER_ERROR' : 'ANSWER') || 'ANSWER');
  const payload = {
    ok: true,
    requestId: meta.requestId,
    idempotencyKey: meta.idempotencyKey,
    message,
    provider,
    model,
    activeMode,
    selectedProvider: provider,
    usedFallback,
    fallbackReason,
    aiError,
    finalProviderUsed: normalizedFinalProvider,
    providerAttemptOrder: normalizeAiProviderAttemptOrder(providerAttemptOrder, normalizedFinalProvider),
    providerErrors: normalizeAiProviderErrors({ providerErrors }),
    providerAttempts: normalizedProviderAttempts,
    promptTokens: tokenStats.prompt_tokens,
    responseTokens: tokenStats.response_tokens,
    modelName: model || '',
    finalOutcome: normalizedFinalOutcome,
    final_provider_used: normalizedFinalProvider,
    provider_attempt_order: normalizeAiProviderAttemptOrder(providerAttemptOrder, normalizedFinalProvider),
    provider_errors: normalizeAiProviderErrors({ providerErrors }),
    provider_attempts: normalizedProviderAttempts,
    prompt_tokens: tokenStats.prompt_tokens,
    response_tokens: tokenStats.response_tokens,
    model_name: model || '',
    final_outcome: normalizedFinalOutcome,
    is_fallback_used: usedFallback === true
  };

  persistAiTrace(res, {
    request_id: meta.requestId,
    thread_id: meta.threadId,
    user_id: meta.userId,
    provider_attempts: normalizedProviderAttempts,
    final_provider_used: normalizedFinalProvider,
    model_name: model || '',
    prompt_tokens: tokenStats.prompt_tokens,
    response_tokens: tokenStats.response_tokens,
    final_outcome: normalizedFinalOutcome,
    reason_if_in_character_error: String(aiError?.reasonIfInCharacterError || aiError?.reason_if_in_character_error || '')
  });

  return res.status(201).json(payload);
}

function sendAiError(res, error, meta) {
  const response = buildAiErrorResponse(error, {
    requestId: meta.requestId,
    idempotencyKey: meta.idempotencyKey
  });
  if (response.code === 'RATE_LIMIT' && Number(error?.retryAfterMs || 0) > 0 && Number(meta.userId || 0) > 0) {
    setAiReplyCooldown(meta.userId, error.retryAfterMs);
  }
  if (Number(error?.retryAfterMs || 0) > 0) {
    res.set('Retry-After', String(Math.max(1, Math.ceil(Number(error.retryAfterMs) / 1000))));
    res.set('X-RateLimit-Retry-After-Ms', String(Number(error.retryAfterMs)));
  }
  const providerAttempts = normalizeProviderAttempts(error);
  persistAiTrace(res, {
    request_id: meta.requestId,
    thread_id: meta.threadId,
    user_id: meta.userId,
    provider_attempts: providerAttempts,
    final_provider_used: String(error?.finalProviderUsed || error?.provider || meta.provider || 'openai'),
    model_name: '',
    prompt_tokens: null,
    response_tokens: null,
    final_outcome: 'HTTP_ERROR',
    reason_if_in_character_error: String(error?.reasonIfInCharacterError || '')
  });
  logAiReplyEvent(response.status >= 500 ? 'error' : 'warn', {
    provider_attempt_order: normalizeAiProviderAttemptOrder(
      error?.providerAttemptOrder,
      String(error?.provider || meta.provider || 'openai')
    ),
    request_id: meta.requestId,
    idempotency_key: meta.idempotencyKey || null,
    user_id: meta.userId,
    thread_id: meta.threadId,
    provider: String(error?.provider || meta.provider || 'openai'),
    chosen_provider: String(error?.provider || meta.provider || 'openai'),
    active_mode: String(error?.activeMode || meta.activeMode || 'auto'),
    fallback_reason: String(error?.fallbackReason || '') || null,
    latency_ms: Number(error?.latencyMs || meta.latencyMs || 0),
    error_code: response.code,
    http_status: response.status,
    provider_status: Number(error?.providerStatus || 0) || null,
    provider_request_id: String(error?.providerRequestId || '') || null,
    provider_error_type: String(error?.providerErrorType || '') || null,
    provider_error_code: String(error?.providerErrorCode || '') || null,
    retry_after_header: String(error?.retryAfterHeader || '') || null,
    retry_after_ms: Number(error?.retryAfterMs || 0) || null,
    rate_limit_headers: error?.rateLimitHeaders || null,
    provider_attempt_count: Number(error?.attempts || 1),
    provider_attempts: providerAttempts,
    openai_error_code: normalizeAiProviderErrors(error).openai || (String(error?.provider || '') === 'openai' ? String(response.code || '') : null),
    ollama_error_code: normalizeAiProviderErrors(error).ollama || (String(error?.provider || '') === 'ollama' ? String(response.code || '') : null),
    final_provider_used: String(error?.finalProviderUsed || error?.provider || meta.provider || 'openai'),
    total_latency_ms: Number(error?.latencyMs || meta.latencyMs || 0),
    final_outcome: 'HTTP_ERROR',
    model_name: null,
    prompt_tokens: null,
    response_tokens: null,
    reason_if_in_character_error: String(error?.reasonIfInCharacterError || '')
  });
  return res.status(response.status).json(response);
}

function slugifyServerName(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'server';
}

function uniqueServerSlug(base) {
  if (!serverSlugExists(base)) {
    return base;
  }
  let i = 2;
  while (serverSlugExists(`${base}-${i}`)) {
    i += 1;
  }
  return `${base}-${i}`;
}

function getRequestHostname(req) {
  const hostHeader = String(req.get('host') || '').trim();
  if (hostHeader) {
    const value = hostHeader.startsWith('[')
      ? hostHeader.slice(1).split(']')[0]
      : hostHeader.split(':')[0];
    return value || String(req.hostname || '').trim();
  }
  return String(req.hostname || '').trim();
}

function isVoiceSecureOriginRequired(req) {
  const explicit = req.app?.locals?.network?.voiceRequiresSecureOrigin;
  if (typeof explicit === 'boolean') {
    return explicit;
  }
  return String(process.env.VOICE_REQUIRE_SECURE_ORIGIN || '1') !== '0';
}

function isVoiceRequestSecure(req) {
  if (!isVoiceSecureOriginRequired(req)) {
    return true;
  }
  if (req.secure) {
    return true;
  }
  return isLoopbackHost(getRequestHostname(req));
}

function isVoiceTurnRequired(req) {
  const explicit = req.app?.locals?.network?.voiceRequireTurn;
  if (typeof explicit === 'boolean') {
    return explicit;
  }
  return String(process.env.VOICE_REQUIRE_TURN || '1') !== '0';
}

function isVoiceTurnConfigured(req) {
  const explicit = req.app?.locals?.network?.turnConfigured;
  if (typeof explicit === 'boolean') {
    return explicit;
  }
  return Boolean(process.env.TURN_URLS || process.env.TURN_URL);
}

function getVoiceIceServers(req) {
  const servers = req.app?.locals?.network?.voiceIceServers;
  return Array.isArray(servers) ? servers : [];
}

function suggestAssetName(baseName, takenNames = []) {
  const base = String(baseName || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32);
  if (!base) {
    return '';
  }
  const taken = new Set(takenNames.map((value) => String(value || '').toLowerCase()));
  if (!taken.has(base)) {
    return base;
  }
  let idx = 2;
  while (idx < 9999) {
    const candidate = `${base}_${idx}`.slice(0, 32);
    if (!taken.has(candidate)) {
      return candidate;
    }
    idx += 1;
  }
  return base;
}

function tooManyMessages(userId) {
  const now = Date.now();
  const key = `msg:${userId}`;
  const bucket = sendBuckets.get(key) || { hits: 0, resetAt: now + 10000 };

  if (now > bucket.resetAt) {
    bucket.hits = 0;
    bucket.resetAt = now + 10000;
  }

  bucket.hits += 1;
  sendBuckets.set(key, bucket);
  return bucket.hits > 6;
}

function tooManyAiReplies(userId) {
  const now = Date.now();
  const key = `ai:${userId}`;
  const bucket = aiReplyBuckets.get(key) || { hits: 0, resetAt: now + 60000 };

  if (now > bucket.resetAt) {
    bucket.hits = 0;
    bucket.resetAt = now + 60000;
  }

  bucket.hits += 1;
  aiReplyBuckets.set(key, bucket);
  return bucket.hits > 6;
}

function getAiReplyCooldown(userId) {
  const key = `ai:${userId}`;
  const until = Number(aiReplyCooldowns.get(key) || 0);
  if (!until || until <= Date.now()) {
    aiReplyCooldowns.delete(key);
    return 0;
  }
  return until - Date.now();
}

function setAiReplyCooldown(userId, retryAfterMs) {
  const cooldownMs = Math.max(0, Number(retryAfterMs || 0));
  if (!cooldownMs) {
    return;
  }
  aiReplyCooldowns.set(`ai:${userId}`, Date.now() + cooldownMs);
}

function getCurrentUserSettings(req) {
  return getUserSettings(req.session.userId);
}

async function maybeTriggerSokratesServerInteraction({
  req,
  serverId,
  channelId,
  sourceMessage
}) {
  const serverChannels = listChannelsForServer(serverId);
  const textChannels = serverChannels.filter((channel) => channel.type === 'text');
  const installation = getServerAppInstallation(serverId, SOKRATES_SERVER_APP_ID);
  const appState = buildSokratesServerAppView(installation, textChannels);
  const settings = appState.settings;
  const testPlan = parseSokratesServerTestPlan(req.body);

  if (!appState.installed || !settings.enabled) {
    return null;
  }
  if (!isSokratesServerChannelAllowed(settings, channelId)) {
    return null;
  }
  if (settings.ignore_bots && (req.currentUser?.is_system_agent || sourceMessage?.author_is_system_agent)) {
    return null;
  }

  const plainTextLength = String(sourceMessage?.content || '').trim().length;
  const hasMedia = (Array.isArray(sourceMessage?.attachments) && sourceMessage.attachments.length)
    || (Array.isArray(sourceMessage?.gifs) && sourceMessage.gifs.length);
  if (!testPlan?.forceAction && plainTextLength < Number(settings.min_message_length || 1) && !hasMedia) {
    return null;
  }
  if (!testPlan?.forceAction && hasSokratesServerCooldown(serverId, channelId, settings)) {
    return null;
  }

  const decision = chooseSokratesServerAction(settings, testPlan);
  if (!decision) {
    return null;
  }

  const sokratesUser = ensureSokratesAgentUser();
  if (!sokratesUser?.id) {
    return null;
  }

  try {
    if (decision.type === 'reaction') {
      const reacted = addReactionToMessage({
        messageId: sourceMessage.id,
        authorId: sokratesUser.id,
        emoji: decision.emoji
      });
      if (!reacted) {
        return null;
      }
      recordSokratesServerAction(serverId, channelId, settings);
      return {
        type: 'reaction',
        messageId: Number(sourceMessage.id || 0),
        reactions: reacted.reactions || []
      };
    }

    const history = listMessagesForChannel(channelId, SOKRATES_SERVER_REPLY_CONTEXT_LIMIT)
      .filter((message) => !message.author_is_system_agent || message.agent_slug === SOKRATES_AGENT_SLUG)
      .slice(-SOKRATES_SERVER_REPLY_CONTEXT_LIMIT);
    if (!history.length) {
      return null;
    }

    const reply = await generateSokratesReply({
      history,
      userSettings: getCurrentUserSettings(req),
      providerTestPlan: testPlan?.providerTestPlan || null,
      completionOptions: {
        systemPrompt: SOKRATES_SERVER_SYSTEM_PROMPT,
        maxTokens: 140,
        temperature: 0.6
      }
    });
    const text = sanitizeSokratesServerReply(reply.text);
    if (!text) {
      return null;
    }

    const messageId = createMessageInChannel({
      channelId,
      authorId: sokratesUser.id,
      content: text,
      replyToMessageId: Number(sourceMessage.id || 0)
    });
    const message = getHydratedMessageById(messageId);
    if (!message) {
      return null;
    }

    recordSokratesServerAction(serverId, channelId, settings);
    return {
      type: 'text',
      message
    };
  } catch (error) {
    logSokratesServerSilentFailure({
      serverId,
      channelId,
      messageId: sourceMessage?.id,
      error
    });
    return null;
  }
}

function resolveVoiceChannelContext(serverId, userId, channelId) {
  const membership = getServerMembership(serverId, userId);
  if (!membership) {
    return { ok: false, code: 'not_member' };
  }

  const channel = listChannelsForServer(serverId).find((entry) => Number(entry.id) === Number(channelId));
  if (!channel || channel.type !== 'voice') {
    return { ok: false, code: 'voice_channel_missing' };
  }

  return {
    ok: true,
    membership,
    channel
  };
}

function parseComposerPayload(body) {
  const text = String(body.content || '').trim();
  const allowedMimes = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'application/pdf',
    'text/plain'
  ]);

  const safeAttachments = [];
  const safeEmojiEntities = [];
  const safeGifIds = [];
  let totalAttachmentBytes = 0;

  if (body.attachmentsPayload) {
    try {
      const parsed = Array.isArray(body.attachmentsPayload)
        ? body.attachmentsPayload
        : JSON.parse(String(body.attachmentsPayload));
      if (Array.isArray(parsed)) {
        parsed.slice(0, 3).forEach((item) => {
          const filename = String(item?.filename || '').slice(0, 180);
          const mime = String(item?.mime_type || '').toLowerCase();
          const kind = String(item?.kind || 'file').toLowerCase();
          const url = String(item?.url || '');
          const size = Number(item?.file_size || 0);

          if (!filename || !mime || !url || !allowedMimes.has(mime)) {
            return;
          }
          if (!url.startsWith(`data:${mime};base64,`)) {
            return;
          }
          if (!Number.isFinite(size) || size <= 0 || size > 2 * 1024 * 1024) {
            return;
          }

          totalAttachmentBytes += size;
          if (totalAttachmentBytes > 8 * 1024 * 1024) {
            return;
          }

          safeAttachments.push({
            kind: ['image', 'video', 'gif'].includes(kind) ? kind : (mime.startsWith('image/') ? 'image' : (mime.startsWith('video/') ? 'video' : 'file')),
            mime_type: mime,
            filename,
            file_size: size,
            url
          });
        });
      }
    } catch (error) {
      // Ignore malformed payload and continue with text-only behavior.
    }
  }

  if (body.gifPayload) {
    try {
      const parsedGif = typeof body.gifPayload === 'object' && body.gifPayload !== null
        ? body.gifPayload
        : JSON.parse(String(body.gifPayload));
      const gifId = Number(parsedGif?.gifId || parsedGif?.id || 0);
      if (gifId > 0) {
        safeGifIds.push(gifId);
      }
    } catch (error) {
      // Ignore malformed gif payload.
    }
  }

  if (body.emojiEntitiesPayload) {
    try {
      const parsedEntities = Array.isArray(body.emojiEntitiesPayload)
        ? body.emojiEntitiesPayload
        : JSON.parse(String(body.emojiEntitiesPayload));
      if (Array.isArray(parsedEntities)) {
        parsedEntities.slice(0, 20).forEach((entity) => {
          const emojiId = Number(entity?.id || 0);
          const token = String(entity?.token || '').trim().slice(0, 80);
          if (!emojiId || !token.startsWith(':') || !token.endsWith(':')) {
            return;
          }
          safeEmojiEntities.push({ id: emojiId, token });
        });
      }
    } catch (error) {
      // Ignore malformed custom emoji entities.
    }
  }

  return {
    text,
    attachments: safeAttachments,
    emojiEntities: safeEmojiEntities,
    gifIds: safeGifIds
  };
}

function hydrateThreadLabel(thread, userId) {
  const participants = applyPresenceToCollection(listParticipantsForThread(thread.id));
  const others = participants.filter((p) => p.id !== userId);
  const aiThread = isAiDmThread(thread);
  const directOther = !aiThread && !thread.is_group ? (others[0] || null) : null;
  const directOtherView = directOther ? decorateProfileForView(directOther) : null;
  const aiOtherView = aiThread && others[0] ? decorateProfileForView(others[0]) : null;
  const name = aiThread
    ? SOKRATES_DISPLAY_NAME
    : thread.is_group
      ? thread.title || others.map((o) => o.display_name).join(', ')
      : (others[0] ? others[0].display_name : 'Direct Message');
  const avatarUrl = aiThread
    ? (aiOtherView?.avatar_url || SOKRATES_AVATAR_URL)
    : (thread.is_group ? '' : (directOtherView?.avatar_url || ''));
  const secondaryLine = aiThread
    ? 'AI'
    : thread.is_group
      ? (participants.length ? `${participants.length} Mitglieder` : '')
      : (directOtherView?.custom_status_line || '');

  return {
    ...thread,
    participants,
    displayName: name,
    avatarUrl,
    directUserId: directOther?.id || null,
    directUsername: directOther?.username || '',
    presence: directOtherView?.presence || directOther?.presence || 'offline',
    presenceLabel: directOtherView?.presence_label || directOther?.presence_label || getPresenceLabel('offline'),
    last_seen: directOther?.last_seen || null,
    secondaryLine,
    isAiThread: aiThread,
    isPriority: !aiThread && thread.muted === 0 && (thread.mention_count > 0 || thread.unread_count > 0)
  };
}

router.get('/presence/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });
  res.flushHeaders && res.flushHeaders();

  const writeEvent = (eventName, payload) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  writeEvent('presence:bulk', getPresenceBulk());

  const unsubscribe = subscribe((payload) => {
    writeEvent('presence:update', payload);
  });

  req.on('close', () => {
    unsubscribe();
    res.end();
  });
});

router.post('/presence/heartbeat', (req, res) => {
  const presence = touchHeartbeat(req.session.userId, {
    manualStatus: req.currentUser?.presence_status || 'online',
    clientIdle: req.body?.idle === true || req.body?.isIdle === true
  });
  return res.json({
    ok: true,
    presence
  });
});

router.post('/presence/disconnect', (req, res) => {
  const presence = markDisconnected(req.session.userId, {
    manualStatus: req.currentUser?.presence_status || 'online'
  });
  return res.json({
    ok: true,
    presence
  });
});

router.post('/test/fixtures/dm-visual', (req, res) => {
  if (process.env.APP_TEST_MODE !== '1') {
    return res.status(404).json({
      ok: false,
      error: 'not_found'
    });
  }

  const fixtureState = applyDmVisualFixtureState(req.session.userId);
  return res.json({
    ok: true,
    ...fixtureState
  });
});

router.get('/profile/:userId', (req, res) => {
  const profile = findUserProfileById(Number(req.params.userId || 0));
  if (!profile) {
    return res.status(404).json({ ok: false, error: 'user_not_found' });
  }

  const sokratesAgent = ensureSokratesAgentUser();
  if (profile.is_system_agent && Number(profile.id || 0) !== Number(sokratesAgent.id || 0)) {
    return res.status(404).json({ ok: false, error: 'user_not_found' });
  }

  return res.json(buildFullProfilePayload(req.session.userId, profile));
});

router.post('/profile/:userId/photo', (req, res) => {
  const targetUserId = Number(req.params.userId || 0);
  if (!targetUserId || targetUserId !== Number(req.session.userId || 0)) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  const profile = findUserProfileById(targetUserId);
  if (!profile || profile.is_system_agent) {
    return res.status(404).json({ ok: false, error: 'user_not_found' });
  }

  if (countUserProfileMedia(targetUserId) >= PROFILE_PHOTO_MAX_ITEMS) {
    return res.status(400).json({ ok: false, error: 'profile_photo_limit' });
  }

  const dataUrl = String(req.body?.dataUrl || '').trim();
  if (!dataUrl) {
    return res.status(400).json({ ok: false, error: 'missing_photo' });
  }

  let fileUrl = '';
  try {
    fileUrl = persistProfileDataUrlAsset(dataUrl, {
      userId: targetUserId,
      kind: 'photo',
      allowVideo: true,
      maxBytes: PROFILE_PHOTO_MAX_BYTES
    });
  } catch (_error) {
    return res.status(400).json({ ok: false, error: 'invalid_photo_upload' });
  }

  createUserProfileMedia({
    userId: targetUserId,
    title: req.body?.title,
    fileUrl,
    mimeType: String(req.body?.mimeType || '').trim() || String(dataUrl.match(/^data:([^;,]+)/)?.[1] || ''),
    visibility: req.body?.visibility,
    effectName: req.body?.effectName
  });

  return res.json(buildFullProfilePayload(req.session.userId, findUserProfileById(targetUserId)));
});

router.post('/profile/:userId/about-plus', async (req, res) => {
  const targetUserId = Number(req.params.userId || 0);
  if (!targetUserId || targetUserId !== Number(req.session.userId || 0)) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  const profile = findUserProfileById(targetUserId);
  if (!profile || profile.is_system_agent) {
    return res.status(404).json({ ok: false, error: 'user_not_found' });
  }

  const defaults = buildDefaultAboutPlus(profile);
  const currentExtras = normalizeAboutPlusPayload(getUserProfileExtras(targetUserId), defaults);
  const source = req.body?.aboutPlus && typeof req.body.aboutPlus === 'object'
    ? req.body.aboutPlus
    : {};
  const incoming = Array.isArray(source.fields)
    ? normalizeAboutPlusPayload(source, currentExtras)
    : {
      fields: currentExtras.fields.map((field, index) => {
        const patch = source?.[field.key];
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
          return normalizeAboutPlusField(field, index, field);
        }
        const nextValue = field.type === 'quote'
          ? (patch.value && typeof patch.value === 'object' && !Array.isArray(patch.value)
            ? patch.value
            : {
              text: patch.value,
              source: field.value?.source || ''
            })
          : (field.type === 'media_card'
            ? (patch.value && typeof patch.value === 'object' && !Array.isArray(patch.value)
              ? patch.value
              : field.value)
          : (field.type === 'list'
            ? (Array.isArray(patch.value)
              ? patch.value
              : String(patch.value || '')
                .split(/\r?\n|,/)
                .map((item) => item.trim())
                .filter(Boolean))
            : patch.value));
        const nextMedia = field.template_key === 'favorite_food'
          ? {
            ...(field.media || {}),
            data_url: String(patch.image_data || '').trim()
          }
          : (field.media || {});
        return normalizeAboutPlusField({
          ...field,
          value: nextValue,
          visible: patch.visibility !== 'private',
          media: nextMedia
        }, index, field);
      })
    };

  try {
    incoming.fields = incoming.fields.map((field, index) => {
      const supportsMedia = field.type === 'media_card' || field.template_key === 'favorite_food';
      if (!supportsMedia) {
        return normalizeAboutPlusField(field, index, field);
      }
      if (field.type === 'media_card') {
        const nextValue = field.value && typeof field.value === 'object' && !Array.isArray(field.value)
          ? { ...field.value }
          : { items: [] };
        nextValue.items = getAboutPlusMediaCardItems(nextValue).map((item) => {
          const nextItem = { ...item };
          if (String(nextItem.data_url || '').startsWith('data:')) {
            nextItem.file_url = persistProfileDataUrlAsset(nextItem.data_url, {
              userId: targetUserId,
              kind: 'about-plus-media',
              maxBytes: ABOUT_PLUS_IMAGE_MAX_BYTES
            });
            nextItem.data_url = '';
          }
          return normalizeAboutPlusMediaValue(nextItem, field.max_length || 160);
        }).slice(0, 3);
        return normalizeAboutPlusField({
          ...field,
          value: nextValue
        }, index, field);
      }
      const media = field.media && typeof field.media === 'object'
        ? { ...field.media }
        : {};
      if (source?.favorite_food_remove_image === true && field.template_key === 'favorite_food') {
        media.file_url = '';
        media.data_url = '';
      } else if (String(media.data_url || '').startsWith('data:')) {
        media.file_url = persistProfileDataUrlAsset(media.data_url, {
          userId: targetUserId,
          kind: field.type === 'media_card' ? 'about-plus-media' : 'about-plus-food',
          maxBytes: ABOUT_PLUS_IMAGE_MAX_BYTES
        });
        media.data_url = '';
      }
      return normalizeAboutPlusField({
        ...field,
        media
      }, index, field);
    });
    incoming.fields = await attachFavoriteGameCoverToAboutPlusFields(targetUserId, incoming.fields);
  } catch (_error) {
    return res.status(400).json({ ok: false, error: 'invalid_about_plus_image' });
  }

  upsertUserProfileExtras(targetUserId, incoming);

  return res.json(buildFullProfilePayload(req.session.userId, findUserProfileById(targetUserId)));
});

router.get('/home', (req, res) => {
  ensureSokratesThreadForUser(req.session.userId);
  const threadsRaw = listDMThreadsForUser(req.session.userId);
  const threads = threadsRaw.map((t) => hydrateThreadLabel(t, req.session.userId));
  const defaultThread = threads.find((thread) => !thread.isAiThread) || threads[0] || null;

  const selectedThreadId = Number(req.query.thread || defaultThread?.id || 0);
  const activeThread = threads.find((t) => t.id === selectedThreadId) || defaultThread || null;

  const peopleQuery = String(req.query.q || '').trim();
  const people = peopleQuery ? searchUsers(peopleQuery, req.session.userId) : [];
  const searchPanelOpen = req.query.searchOpen === '1';
  const servers = listServersForUser(req.session.userId);

  const isBlocked = activeThread && !activeThread.is_group && !activeThread.isAiThread
    ? activeThread.participants.some((p) => p.id !== req.session.userId && isBlockedBetween(req.session.userId, p.id))
    : false;

  const currentUserSettings = getCurrentUserSettings(req);

  const threadMessages = activeThread ? applyPresenceToMessages(listMessagesForThread(activeThread.id, 300)) : [];
  const userEmojis = listAvailableCustomEmojis(req.session.userId);
  const emojiPickerState = getEmojiPickerState(req.session.userId);

  const latestMessageId = activeThread ? getLatestMessageIdForThread(activeThread.id) : null;
  if (activeThread && latestMessageId) {
    markThreadRead(activeThread.id, req.session.userId, latestMessageId);
  }

  const inboxThreads = threads.filter((t) => t.isPriority).slice(0, 6);
  const directOther = activeThread && !activeThread.is_group && !activeThread.isAiThread
    ? activeThread.participants.find((p) => p.id !== req.session.userId)
    : null;
  const directProfile = directOther ? decorateProfileForView(applyPresenceToProfile(findUserProfileById(directOther.id))) : null;
  const directProfileMeta = directOther ? {
    mutualServers: countMutualServers(req.session.userId, directOther.id),
    mutualFriends: countMutualFriends(req.session.userId, directOther.id)
  } : null;
  const sokratesProfile = activeThread && activeThread.isAiThread
    ? buildFullProfilePayload(req.session.userId, findUserProfileById(ensureSokratesAgentUser().id))?.profile || null
    : null;
  const sokratesAvailability = activeThread && activeThread.isAiThread
    ? getSokratesAvailability({ userSettings: currentUserSettings })
    : { available: true, message: '' };

  return res.render('pages/dm-home', {
    title: 'Apeiron DMs',
    currentUser: req.currentUser,
    threads,
    inboxThreads,
    activeThread,
    threadMessages,
    people,
    peopleQuery,
    searchPanelOpen,
    servers,
    selectedServer: null,
    channels: [],
    channelMessages: [],
    focusMessageId: Number(req.query.focusMessage || 0),
    isBlocked,
    currentUserSettings,
    directProfile,
    directProfileMeta,
    sokratesProfile,
    userEmojis,
    emojiPickerState,
    sokratesAvailability
  });
});

router.post('/home/new-dm', (req, res) => {
  const username = String(req.body.username || '').trim().replace(/^@/, '').toLowerCase();
  const targetUser = findUserByUsername(username);

  if (!targetUser) {
    req.flash('error', 'User nicht gefunden.');
    return res.redirect('/app/home');
  }

  if (!canStartDirectDM(req.session.userId, targetUser.id)) {
    req.flash('error', 'Du darfst dieser Person keine DM senden (Privacy/Block).');
    return res.redirect('/app/home');
  }

  const threadId = createDirectThread(req.session.userId, targetUser.id);
  return res.redirect(`/app/home?thread=${threadId}`);
});

router.post('/home/new-group', (req, res) => {
  const title = String(req.body.title || '').trim();
  const iconEmoji = String(req.body.iconEmoji || '').trim().slice(0, 4);
  const handles = String(req.body.members || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);

  const participants = handles
    .map((handle) => findUserByHandle(handle, req.session.userId))
    .filter(Boolean)
    .map((user) => user.id);

  const threadId = createGroupThread({
    creatorId: req.session.userId,
    title,
    iconEmoji,
    participantIds: participants
  });

  req.flash('success', 'Group DM erstellt.');
  return res.redirect(`/app/home?thread=${threadId}`);
});

router.post('/home/group/update', (req, res) => {
  const threadId = Number(req.body.threadId || 0);
  const title = String(req.body.title || '').trim();
  const iconEmoji = String(req.body.iconEmoji || '').trim().slice(0, 4);

  const ok = updateGroupThread(threadId, req.session.userId, { title, iconEmoji });
  if (!ok) {
    req.flash('error', 'Gruppe konnte nicht aktualisiert werden.');
    return res.redirect(`/app/home?thread=${threadId}`);
  }

  req.flash('success', 'Gruppenname/Icon aktualisiert.');
  return res.redirect(`/app/home?thread=${threadId}`);
});

router.post('/home/group/add-member', (req, res) => {
  const threadId = Number(req.body.threadId || 0);
  const handle = String(req.body.username || '').trim();
  const user = findUserByHandle(handle, req.session.userId);

  if (!user) {
    req.flash('error', 'User nicht gefunden.');
    return res.redirect(`/app/home?thread=${threadId}`);
  }

  addParticipantToGroup(threadId, req.session.userId, user.id);
  req.flash('success', '@' + user.username + ' hinzugefügt.');
  return res.redirect(`/app/home?thread=${threadId}`);
});

router.post('/home/group/remove-member', (req, res) => {
  const threadId = Number(req.body.threadId || 0);
  const userId = Number(req.body.userId || 0);
  if (userId === req.session.userId) {
    req.flash('error', 'Du kannst dich nicht selbst entfernen.');
    return res.redirect(`/app/home?thread=${threadId}`);
  }

  const ok = removeParticipantFromGroup(threadId, req.session.userId, userId);
  if (!ok) {
    req.flash('error', 'Keine Berechtigung zum Entfernen dieses Mitglieds.');
    return res.redirect(`/app/home?thread=${threadId}`);
  }
  req.flash('success', 'Teilnehmer entfernt.');
  return res.redirect(`/app/home?thread=${threadId}`);
});

router.post('/home/toggle-mute', (req, res) => {
  const threadId = Number(req.body.threadId || 0);
  const muted = req.body.muted === '1';
  setThreadMute(threadId, req.session.userId, muted);
  return res.redirect(`/app/home?thread=${threadId}`);
});

router.post('/home/message', (req, res) => {
  const threadId = Number(req.body.threadId || 0);
  const editMessageId = Number(req.body.editMessageId || 0);
  const replyToMessageId = Number(req.body.replyToMessageId || 0);
  const payload = parseComposerPayload(req.body);
  const content = payload.text;
  const attachments = payload.attachments;
  const emojiEntitiesRaw = payload.emojiEntities;
  const gifIdsRaw = payload.gifIds;
  const allowedEmojiRows = listAvailableCustomEmojisByIds(req.session.userId, emojiEntitiesRaw.map((item) => item.id));
  const allowedById = new Map(allowedEmojiRows.map((row) => [row.id, row]));
  const emojiEntities = emojiEntitiesRaw
    .filter((entity) => allowedById.has(entity.id))
    .map((entity) => ({ id: entity.id, token: entity.token }));
  const allowedGifs = listGlobalGifsByIds(gifIdsRaw);
  const allowedGifIds = [...new Set(allowedGifs.map((gif) => gif.id))];

  if (tooManyMessages(req.session.userId)) {
    if (req.accepts('json') && req.is('application/json')) {
      return res.status(429).json({ ok: false, error: 'Du sendest zu schnell. Bitte kurz warten.' });
    }
    req.flash('error', 'Du sendest zu schnell. Bitte kurz warten.');
    return res.redirect(`/app/home?thread=${threadId}`);
  }

  ensureSokratesThreadForUser(req.session.userId);
  const threads = listDMThreadsForUser(req.session.userId);
  const active = threads.find((thread) => thread.id === threadId);
  if (!active) {
    if (req.accepts('json') && req.is('application/json')) {
      return res.status(404).json({ ok: false, error: 'Thread nicht gefunden.' });
    }
    req.flash('error', 'Thread nicht gefunden.');
    return res.redirect('/app/home');
  }

  const replyTarget = resolveReplyTargetForCompose({
    replyToMessageId,
    threadId,
    actorId: req.session.userId
  });
  if (!replyTarget.ok) {
    if (req.accepts('json') && req.is('application/json')) {
      return buildJsonMessageActionError(res, 400, 'Reply-Ziel ist ungültig.');
    }
    req.flash('error', 'Reply-Ziel ist ungültig.');
    return res.redirect(`/app/home?thread=${threadId}`);
  }

  if (editMessageId) {
    const editContext = findMessageActionContext(editMessageId);
    if (!editContext || Number(editContext.thread_id || 0) !== threadId) {
      if (req.accepts('json') && req.is('application/json')) {
        return buildJsonMessageActionError(res, 400, 'Diese Nachricht gehört nicht zu diesem Thread.');
      }
      req.flash('error', 'Diese Nachricht gehört nicht zu diesem Thread.');
      return res.redirect(`/app/home?thread=${threadId}`);
    }

    if (!content) {
      if (req.accepts('json') && req.is('application/json')) {
        return buildJsonMessageActionError(res, 400, 'Nachricht ist leer.');
      }
      req.flash('error', 'Nachricht ist leer.');
      return res.redirect(`/app/home?thread=${threadId}`);
    }

    const updateResult = updateMessageForActor({
      messageId: editMessageId,
      actorId: req.session.userId,
      content,
      emojiEntities
    });

    if (!updateResult.ok) {
      const errorText = updateResult.code === 'forbidden'
        ? 'Diese Nachricht kann nicht bearbeitet werden.'
        : 'Nachricht konnte nicht bearbeitet werden.';
      if (req.accepts('json') && req.is('application/json')) {
        return buildJsonMessageActionError(res, updateResult.code === 'forbidden' ? 403 : 400, errorText);
      }
      req.flash('error', errorText);
      return res.redirect(`/app/home?thread=${threadId}`);
    }

    if (req.accepts('json') && req.is('application/json')) {
      return res.json({
        ok: true,
        mode: 'edit',
        message: applyPresenceToMessage(updateResult.message)
      });
    }

    return res.redirect(`/app/home?thread=${threadId}&focusMessage=${editMessageId}`);
  }

  if (!threadId || (!content && !attachments.length && !allowedGifIds.length)) {
    if (req.accepts('json') && req.is('application/json')) {
      return res.status(400).json({ ok: false, error: 'Nachricht konnte nicht gesendet werden.' });
    }
    req.flash('error', 'Nachricht konnte nicht gesendet werden.');
    return res.redirect(`/app/home?thread=${threadId}`);
  }

  if (isAiDmThread(active)) {
    const availability = getSokratesAvailability({ userSettings: getCurrentUserSettings(req) });
    if (!availability.configured) {
      if (req.accepts('json') && req.is('application/json')) {
        return res.status(503).json({
          ok: false,
          error: availability.message || 'Sokrates ist nicht konfiguriert.'
        });
      }
      req.flash('error', availability.message || 'Sokrates ist nicht konfiguriert.');
      return res.redirect(`/app/home?thread=${threadId}`);
    }

    if (!content) {
      if (req.accepts('json') && req.is('application/json')) {
        return res.status(400).json({ ok: false, error: 'Sokrates braucht eine Textfrage.' });
      }
      req.flash('error', 'Sokrates braucht eine Textfrage.');
      return res.redirect(`/app/home?thread=${threadId}`);
    }

    if (content.length > MAX_SOKRATES_PROMPT_CHARS) {
      if (req.accepts('json') && req.is('application/json')) {
        return res.status(400).json({ ok: false, error: 'Deine Frage ist zu lang. Bitte kürze sie.' });
      }
      req.flash('error', 'Deine Frage ist zu lang. Bitte kürze sie.');
      return res.redirect(`/app/home?thread=${threadId}`);
    }
  }

  if (!active.is_group && !isAiDmThread(active)) {
    const other = listParticipantsForThread(threadId).find((p) => p.id !== req.session.userId);
    if (other && isBlockedBetween(req.session.userId, other.id)) {
      if (req.accepts('json') && req.is('application/json')) {
        return res.status(403).json({ ok: false, error: 'Du kannst dieser Person nicht schreiben.' });
      }
      req.flash('error', 'Du kannst dieser Person nicht schreiben.');
      return res.redirect(`/app/home?thread=${threadId}`);
    }
  }

  const messageId = createMessageInThread({
    threadId,
    authorId: req.session.userId,
    content,
    attachments,
    emojiEntities,
    gifIds: allowedGifIds,
    replyToMessageId: replyTarget.replyToMessageId
  });
  if (req.accepts('json') && req.is('application/json')) {
    const message = getHydratedMessageById(messageId);
    return res.status(201).json({
      ok: true,
      message,
      aiThread: isAiDmThread(active),
      aiReplyTargetMessageId: isAiDmThread(active) ? messageId : null,
      aiIdempotencyKey: isAiDmThread(active) ? String(messageId) : null
    });
  }
  return res.redirect(`/app/home?thread=${threadId}&focusMessage=${messageId}`);
});

router.post('/home/ai-reply', async (req, res) => {
  const threadId = Number(req.body.threadId || 0);
  const replyToMessageId = Number(req.body.replyToMessageId || 0);
  const idempotencyKey = String(req.body.idempotencyKey || replyToMessageId || '').trim();
  const aiProviderTestPlan = isDevMode() && req.body.aiProviderTestPlan && typeof req.body.aiProviderTestPlan === 'object'
    ? req.body.aiProviderTestPlan
    : null;
  const requestId = nanoid(10);
  const currentUserSettings = getCurrentUserSettings(req);
  const availability = getSokratesAvailability({ userSettings: currentUserSettings });
  const baseMeta = {
    requestId,
    idempotencyKey,
    userId: req.session.userId,
    threadId,
    provider: availability.provider || 'openai',
    activeMode: availability.activeMode || 'auto',
    latencyMs: 0
  };

  if (!threadId || !replyToMessageId) {
    return sendAiError(
      res,
      new SokratesServiceError('Ungültige Anfrage.', {
        status: 400,
        code: 'VALIDATION_ERROR',
        retryable: false,
        detail: 'Missing threadId or replyToMessageId.',
        provider: baseMeta.provider
      }),
      baseMeta
    );
  }

  if (idempotencyKey && idempotencyKey !== String(replyToMessageId)) {
    return sendAiError(
      res,
      new SokratesServiceError('Ungültiger Idempotency-Key.', {
        status: 400,
        code: 'VALIDATION_ERROR',
        retryable: false,
        detail: 'idempotencyKey must match replyToMessageId.',
        provider: baseMeta.provider
      }),
      baseMeta
    );
  }

  const thread = findThreadByIdForUser(threadId, req.session.userId);
  if (!thread || !isAiDmThread(thread)) {
    return sendAiError(
      res,
      new SokratesServiceError('Sokrates-Thread nicht gefunden.', {
        status: 404,
        code: 'VALIDATION_ERROR',
        retryable: false,
        detail: 'Thread does not exist or is not an AI DM.',
        provider: baseMeta.provider
      }),
      baseMeta
    );
  }

  const participants = listParticipantsForThread(threadId);
  const sokratesParticipant = participants.find((participant) => participant.is_system_agent);
  if (!sokratesParticipant) {
    return sendAiError(
      res,
      new SokratesServiceError(isDevMode() ? 'Sokrates ist nicht konfiguriert.' : 'Sokrates ist vorübergehend nicht verfügbar.', {
        status: 503,
        code: 'CONFIG_ERROR',
        retryable: false,
        detail: 'System agent user is missing from the AI DM thread.',
        provider: baseMeta.provider
      }),
      baseMeta
    );
  }

  const persistAiError = (error) => {
    const safeError = error instanceof SokratesServiceError
      ? error
      : new SokratesServiceError('Sokrates ist vorübergehend nicht verfügbar.', {
        status: 503,
        code: 'PROVIDER_ERROR',
        retryable: true,
        detail: String(error?.message || 'Unknown AI route failure.').slice(0, 240),
        provider: baseMeta.provider,
        activeMode: baseMeta.activeMode
      });
    const dedupePersonaError = [
      'TIMEOUT',
      'PROVIDER_ERROR',
      'RATE_LIMIT',
      'QUOTA',
      'CONFIG_ERROR'
    ].includes(String(safeError.code || '').toUpperCase());
    const transientNoticeKey = dedupePersonaError
      ? `ai_transient:${threadId}:${req.session.userId}:${safeError.code}`
      : '';

    if (dedupePersonaError) {
      const existingNotice = getAiTransientFailureNotice(transientNoticeKey);
      const existingMessage = existingNotice?.messageId
        ? getHydratedMessageById(existingNotice.messageId)
        : null;
      if (existingMessage) {
        safeError.retryAfterMs = Math.max(
          Number(safeError.retryAfterMs || 0),
          Math.max(1000, Number(existingNotice.until || 0) - Date.now())
        );
        logAiReplyEvent('warn', {
          provider_attempt_order: normalizeAiProviderAttemptOrder(
            safeError?.providerAttemptOrder,
            String(safeError?.provider || baseMeta.provider || 'openai')
          ),
          request_id: baseMeta.requestId,
          idempotency_key: baseMeta.idempotencyKey || null,
          user_id: baseMeta.userId,
          thread_id: baseMeta.threadId,
          provider: String(safeError.provider || baseMeta.provider || 'openai'),
          chosen_provider: String(safeError.provider || baseMeta.provider || 'openai'),
          active_mode: String(safeError.activeMode || baseMeta.activeMode || 'auto'),
          fallback_reason: String(safeError.fallbackReason || '') || null,
          latency_ms: Number(safeError.latencyMs || baseMeta.latencyMs || 0),
          error_code: `${String(safeError.code || 'PROVIDER_ERROR')}_DEDUPED`,
          http_status: 200,
          provider_status: Number(safeError.providerStatus || 0) || null,
          provider_request_id: String(safeError.providerRequestId || '') || null,
          provider_error_type: String(safeError.providerErrorType || '') || null,
          provider_error_code: String(safeError.providerErrorCode || '') || null,
          retry_after_header: String(safeError.retryAfterHeader || '') || null,
          retry_after_ms: Number(safeError.retryAfterMs || 0) || null,
          rate_limit_headers: safeError.rateLimitHeaders || null,
          provider_attempt_count: Number(safeError.attempts || 1),
          provider_attempts: normalizeProviderAttempts(safeError),
          openai_error_code: normalizeAiProviderErrors(safeError).openai || (String(safeError?.provider || '') === 'openai' ? String(safeError.code || 'PROVIDER_ERROR') : null),
          ollama_error_code: normalizeAiProviderErrors(safeError).ollama || (String(safeError?.provider || '') === 'ollama' ? String(safeError.code || 'PROVIDER_ERROR') : null),
          final_provider_used: String(safeError?.finalProviderUsed || safeError?.provider || baseMeta.provider || 'openai'),
          total_latency_ms: Number(safeError?.latencyMs || baseMeta.latencyMs || 0),
          final_outcome: 'IN_CHARACTER_ERROR',
          reason_if_in_character_error: String(safeError?.reasonIfInCharacterError || ''),
          model_name: null,
          prompt_tokens: null,
          response_tokens: null
        });
        return sendAiAssistantMessage(res, {
          meta: baseMeta,
          message: existingMessage,
          provider: String(safeError.provider || baseMeta.provider || 'openai'),
          model: '',
          activeMode: String(safeError.activeMode || baseMeta.activeMode || 'auto'),
          usedFallback: false,
          fallbackReason: String(safeError.fallbackReason || ''),
          aiError: buildAiErrorMeta(safeError),
          providerAttemptOrder: safeError.providerAttemptOrder || [],
          providerAttempts: safeError.providerAttempts || [],
          providerErrors: safeError.providerErrors || null,
          finalProviderUsed: String(safeError.finalProviderUsed || safeError.provider || baseMeta.provider || 'openai'),
          finalOutcome: 'IN_CHARACTER_ERROR'
        });
      }

      safeError.retryAfterMs = Math.max(Number(safeError.retryAfterMs || 0), AI_TRANSIENT_ERROR_DEDUP_MS);
    }
    const content = getSokratesPersonaErrorMessage(safeError);
    const messageId = createMessageInThread({
      threadId,
      authorId: sokratesParticipant.id,
      content,
      agentSlug: SOKRATES_AGENT_SLUG
    });
    const message = getHydratedMessageById(messageId);
    if (safeError.code === 'RATE_LIMIT' && Number(safeError.retryAfterMs || 0) > 0 && Number(baseMeta.userId || 0) > 0) {
      setAiReplyCooldown(baseMeta.userId, safeError.retryAfterMs);
    }
    if (dedupePersonaError) {
      rememberAiTransientFailureNotice(transientNoticeKey, messageId, safeError.retryAfterMs);
    }
    logAiReplyEvent(safeError.status >= 500 ? 'error' : 'warn', {
      provider_attempt_order: normalizeAiProviderAttemptOrder(
        safeError?.providerAttemptOrder,
        String(safeError?.provider || baseMeta.provider || 'openai')
      ),
      request_id: baseMeta.requestId,
      idempotency_key: baseMeta.idempotencyKey || null,
      user_id: baseMeta.userId,
      thread_id: baseMeta.threadId,
      provider: String(safeError.provider || baseMeta.provider || 'openai'),
      chosen_provider: String(safeError.provider || baseMeta.provider || 'openai'),
      active_mode: String(safeError.activeMode || baseMeta.activeMode || 'auto'),
      fallback_reason: String(safeError.fallbackReason || '') || null,
      latency_ms: Number(safeError.latencyMs || baseMeta.latencyMs || 0),
      error_code: String(safeError.code || 'PROVIDER_ERROR'),
      http_status: 201,
      provider_status: Number(safeError.providerStatus || 0) || null,
      provider_request_id: String(safeError.providerRequestId || '') || null,
      provider_error_type: String(safeError.providerErrorType || '') || null,
      provider_error_code: String(safeError.providerErrorCode || '') || null,
      retry_after_header: String(safeError.retryAfterHeader || '') || null,
      retry_after_ms: Number(safeError.retryAfterMs || 0) || null,
      rate_limit_headers: safeError.rateLimitHeaders || null,
      provider_attempt_count: Number(safeError.attempts || 1),
      provider_attempts: normalizeProviderAttempts(safeError),
      openai_error_code: normalizeAiProviderErrors(safeError).openai || (String(safeError?.provider || '') === 'openai' ? String(safeError.code || 'PROVIDER_ERROR') : null),
      ollama_error_code: normalizeAiProviderErrors(safeError).ollama || (String(safeError?.provider || '') === 'ollama' ? String(safeError.code || 'PROVIDER_ERROR') : null),
      final_provider_used: String(safeError?.finalProviderUsed || safeError?.provider || baseMeta.provider || 'openai'),
      total_latency_ms: Number(safeError?.latencyMs || baseMeta.latencyMs || 0),
      final_outcome: 'IN_CHARACTER_ERROR',
      reason_if_in_character_error: String(safeError?.reasonIfInCharacterError || ''),
      model_name: null,
      prompt_tokens: null,
      response_tokens: null
    });
    return sendAiAssistantMessage(res, {
      meta: baseMeta,
      message,
      provider: String(safeError.provider || baseMeta.provider || 'openai'),
      model: '',
      activeMode: String(safeError.activeMode || baseMeta.activeMode || 'auto'),
      usedFallback: false,
      fallbackReason: String(safeError.fallbackReason || ''),
      aiError: buildAiErrorMeta(safeError),
      providerAttemptOrder: safeError.providerAttemptOrder || [],
      providerAttempts: safeError.providerAttempts || [],
      providerErrors: safeError.providerErrors || null,
      finalProviderUsed: String(safeError.finalProviderUsed || safeError.provider || baseMeta.provider || 'openai'),
      finalOutcome: 'IN_CHARACTER_ERROR'
    });
  };

  if (tooManyAiReplies(req.session.userId)) {
    return persistAiError(
      new SokratesServiceError('Rate limit erreicht. Bitte warte 2 Sekunden und versuche es erneut.', {
        status: 429,
        code: 'RATE_LIMIT',
        retryable: true,
        retryAfterMs: 2000,
        detail: 'Local AI reply rate limiter triggered.',
        provider: baseMeta.provider
      })
    );
  }

  const activeCooldownMs = getAiReplyCooldown(req.session.userId);
  if (activeCooldownMs > 0) {
    return persistAiError(
      new SokratesServiceError(`Rate limit erreicht. Bitte warte ${Math.max(1, Math.ceil(activeCooldownMs / 1000))} Sekunde${Math.ceil(activeCooldownMs / 1000) === 1 ? '' : 'n'} und versuche es erneut.`, {
        status: 429,
        code: 'RATE_LIMIT',
        retryable: true,
        retryAfterMs: activeCooldownMs,
        detail: 'AI cooldown is active after a previous rate limit.',
        provider: baseMeta.provider,
        activeMode: baseMeta.activeMode
      })
    );
  }

  const recentMessages = listMessagesForThread(threadId, 60);
  const newerUserMessageExists = recentMessages.some((message) =>
    Number(message.id) > replyToMessageId
      && !message.agent_slug
      && !message.author_is_system_agent
  );
  if (newerUserMessageExists) {
    return persistAiError(
      new SokratesServiceError('Diese frühere Frage ist nicht mehr offen. Stelle die Rückfrage bitte neu.', {
        status: 409,
        code: 'VALIDATION_ERROR',
        retryable: false,
        detail: 'A newer user message already exists in the same AI thread.',
        provider: baseMeta.provider
      })
    );
  }

  const existingReply = findAgentReplyAfterMessage(threadId, replyToMessageId, SOKRATES_AGENT_SLUG);
  if (existingReply) {
    logAiReplyEvent('info', {
      provider_attempt_order: normalizeAiProviderAttemptOrder(
        existingReply?.providerAttemptOrder,
        baseMeta.provider
      ),
      request_id: requestId,
      idempotency_key: idempotencyKey || null,
      user_id: req.session.userId,
      thread_id: threadId,
      provider: baseMeta.provider,
      chosen_provider: baseMeta.provider,
      active_mode: baseMeta.activeMode,
      fallback_reason: null,
      latency_ms: 0,
      error_code: null,
      http_status: 200,
      provider_status: null,
      provider_request_id: null,
      provider_error_type: null,
      provider_error_code: null,
      retry_after_header: null,
      retry_after_ms: null,
      rate_limit_headers: null,
      provider_attempt_count: 1,
      provider_attempts: [],
      openai_error_code: null,
      ollama_error_code: null,
      final_provider_used: String(baseMeta.provider || 'openai'),
      total_latency_ms: 0,
      final_outcome: 'ANSWER',
      model_name: availability.model || null,
      prompt_tokens: null,
      response_tokens: null,
      reason_if_in_character_error: null
    });
    return sendAiAssistantMessage(res, {
      meta: baseMeta,
      message: existingReply,
      provider: baseMeta.provider,
      model: availability.model || '',
      activeMode: baseMeta.activeMode,
      usedFallback: false,
      fallbackReason: '',
      aiError: null,
      providerAttemptOrder: [baseMeta.provider],
      providerErrors: null,
      finalProviderUsed: baseMeta.provider,
      finalOutcome: 'ANSWER'
    });
  }

  const targetMessage = getHydratedMessageById(replyToMessageId);
  if (!targetMessage || Number(targetMessage.thread_id) !== threadId || Number(targetMessage.author_id) !== req.session.userId) {
    return persistAiError(
      new SokratesServiceError('Ausgangsnachricht nicht gefunden.', {
        status: 404,
        code: 'VALIDATION_ERROR',
        retryable: false,
        detail: 'replyToMessageId is not owned by the current user in this thread.',
        provider: baseMeta.provider
      })
    );
  }

  if (String(targetMessage.content || '').trim().length > MAX_SOKRATES_PROMPT_CHARS) {
    return persistAiError(
      new SokratesServiceError('Deine Frage ist zu lang. Bitte kürze sie.', {
        status: 400,
        code: 'VALIDATION_ERROR',
        retryable: false,
        detail: `Prompt exceeded ${MAX_SOKRATES_PROMPT_CHARS} characters.`,
        provider: baseMeta.provider
      })
    );
  }

  const history = listMessagesForThreadThroughMessage(threadId, replyToMessageId, 60);
  const activeInFlightKey = aiReplyInflightThreads.get(threadId);

  if (activeInFlightKey) {
    return persistAiError(
      new SokratesServiceError('Sokrates beantwortet bereits deine letzte Frage. Bitte kurz warten.', {
        status: 429,
        code: 'RATE_LIMIT',
        retryable: true,
        retryAfterMs: 1000,
        detail: `AI request already in flight for thread ${threadId}.`,
        provider: baseMeta.provider
      })
    );
  }

  const requestAbortController = new AbortController();
  const onRequestClosed = () => {
    if (!res.writableEnded) {
      requestAbortController.abort();
    }
  };
  req.on('close', onRequestClosed);
  aiReplyInflightThreads.set(threadId, idempotencyKey || String(replyToMessageId));

  try {
    const result = await generateSokratesReply({
      history,
      userSettings: currentUserSettings,
      signal: requestAbortController.signal,
      providerTestPlan: aiProviderTestPlan,
      completionOptions: {
        // Keep DM replies fast and stable enough for interactive chat.
        maxTokens: 120,
        temperature: 0.6
      }
    });
    const content = result.text;
    const messageId = createMessageInThread({
      threadId,
      authorId: sokratesParticipant.id,
      content,
      agentSlug: SOKRATES_AGENT_SLUG
    });
    const message = getHydratedMessageById(messageId);
    const usageStats = buildAiTokenStats(result.usage);
    logAiReplyEvent('info', {
      provider_attempt_order: normalizeAiProviderAttemptOrder(
        result.providerAttemptOrder,
        String(result.providerName || baseMeta.provider || 'openai')
      ),
      request_id: requestId,
      idempotency_key: idempotencyKey || null,
      user_id: req.session.userId,
      thread_id: threadId,
      provider: result.providerName || baseMeta.provider,
      chosen_provider: result.providerName || baseMeta.provider,
      active_mode: result.activeMode || baseMeta.activeMode,
      fallback_reason: String(result.fallbackReason || '') || null,
      latency_ms: Number(result.latencyMs || 0),
      error_code: null,
      http_status: 201,
      provider_status: null,
      provider_request_id: String(result.providerRequestId || '') || null,
      provider_error_type: null,
      provider_error_code: null,
      retry_after_header: null,
      retry_after_ms: null,
      rate_limit_headers: result.rateLimitHeaders || null,
      provider_attempt_count: Number(result.attempts || 1),
      provider_attempts: normalizeProviderAttempts(result),
      openai_error_code: normalizeAiProviderErrors(result).openai || null,
      ollama_error_code: normalizeAiProviderErrors(result).ollama || null,
      final_provider_used: String(result.finalProviderUsed || result.providerName || baseMeta.provider || 'openai'),
      total_latency_ms: Number(result.latencyMs || 0),
      final_outcome: 'ANSWER',
      model_name: String(result.model || availability.model || ''),
      prompt_tokens: usageStats.prompt_tokens,
      response_tokens: usageStats.response_tokens,
      reason_if_in_character_error: null
    });
    return sendAiAssistantMessage(res, {
      meta: baseMeta,
      message,
      provider: result.providerName || baseMeta.provider,
      model: result.model || availability.model || '',
      activeMode: result.activeMode || baseMeta.activeMode,
      usedFallback: result.usedFallback === true,
      fallbackReason: String(result.fallbackReason || ''),
      aiError: null,
      providerAttemptOrder: result.providerAttemptOrder || [],
      providerAttempts: result.providerAttempts || [],
      providerErrors: result.providerErrors || null,
      finalProviderUsed: String(result.finalProviderUsed || result.providerName || baseMeta.provider || 'openai'),
      usage: result.usage || null,
      finalOutcome: 'ANSWER'
    });
  } catch (error) {
    if (error?.name === 'AbortError' && requestAbortController.signal.aborted) {
      return;
    }

    if (error instanceof SokratesServiceError) {
      return persistAiError(error);
    }

    return persistAiError(error);
  } finally {
    req.off('close', onRequestClosed);
    if (aiReplyInflightThreads.get(threadId) === (idempotencyKey || String(replyToMessageId))) {
      aiReplyInflightThreads.delete(threadId);
    }
  }
});

router.get('/home/ai-status', async (req, res) => {
  const availability = await getSokratesStatus({ userSettings: getCurrentUserSettings(req) });
  return res.json({
    ok: true,
    configured: availability.configured,
    available: availability.available,
    code: availability.code || '',
    message: availability.message || '',
    detail: availability.detail || '',
    provider: availability.provider || 'openai',
    selectedProvider: availability.selectedProvider || 'openai',
    model: availability.model || '',
    activeMode: availability.activeMode || 'auto',
    active_mode: availability.activeMode || 'auto',
    auto_order: availability.autoOrder || ['openai', 'ollama'],
    openaiConfigured: availability.openaiConfigured === true,
    openaiReachable: availability.openaiReachable === true,
    openaiCircuitOpen: availability.openaiCircuitOpen === true,
    openaiCircuitUntil: Number(availability.openaiCircuitUntil || 0),
    openaiCircuitRemainingMs: Number(availability.openaiCircuitRemainingMs || 0),
    openaiCircuitCode: String(availability.openaiCircuitCode || ''),
    ollamaConfigured: availability.ollamaConfigured === true,
    ollamaReachable: availability.ollamaReachable === true,
    ollamaModelPresent: availability.ollamaModelPresent === true,
    ollamaModels: Array.isArray(availability.ollamaModels) ? availability.ollamaModels : [],
    openaiModel: availability.openaiModel || '',
    ollamaModel: availability.ollamaModel || '',
    retryable: availability.retryable !== false
  });
});

router.get('/debug/ai-trace/:id', (req, res) => {
  if (!isDevMode()) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }
  cleanupAiTraceStore();
  const traceId = String(req.params.id || '').trim();
  if (!traceId) {
    return res.status(400).json({ ok: false, error: 'invalid_trace_id' });
  }
  const trace = aiTraceStore.get(traceId);
  if (!trace) {
    return res.status(404).json({ ok: false, error: 'trace_not_found' });
  }
  return res.json({
    ok: true,
    trace
  });
});

router.post('/home/emoji', (req, res) => {
  const name = String(req.body.name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32);
  const mimeType = String(req.body.mimeType || '').toLowerCase();
  const url = String(req.body.url || '');
  const visibility = String(req.body.visibility || 'private').trim().toLowerCase() === 'public' ? 'public' : 'private';
  const validMime = new Set(['image/png', 'image/webp', 'image/gif']);

  if (!name || !mimeType || !url || !validMime.has(mimeType) || !url.startsWith(`data:${mimeType};base64,`)) {
    return res.status(400).json({ ok: false, error: 'Ungültiges Emoji.' });
  }

  const existing = findUserEmojiByName(name);
  if (existing) {
    const suggestedName = suggestAssetName(name, [existing.name]);
    return res.status(409).json({ ok: false, error: 'Name already exists.', suggestedName });
  }

  const approxBytes = Math.ceil((url.length - (`data:${mimeType};base64,`).length) * 0.75);
  if (approxBytes > 1024 * 1024) {
    return res.status(400).json({ ok: false, error: 'Emoji zu groß (max 1MB).' });
  }

  const emoji = createUserEmoji({
    userId: req.session.userId,
    name,
    mimeType,
    url,
    visibility
  });

  if (!emoji) {
    return res.status(400).json({ ok: false, error: 'Emoji konnte nicht gespeichert werden.' });
  }

  return res.status(201).json({ ok: true, emoji });
});

router.post('/home/emoji/favorites', (req, res) => {
  const key = String(req.body.key || '').trim().slice(0, 64);
  const favorite = req.body.favorite !== false && req.body.favorite !== 'false' && req.body.favorite !== 0 && req.body.favorite !== '0';

  if (!key) {
    return res.status(400).json({ ok: false, error: 'Ungültiger Favorit.' });
  }

  const current = getEmojiPickerState(req.session.userId);
  const nextFavorites = favorite
    ? [key, ...current.favorites.filter((entry) => entry !== key)].slice(0, 48)
    : current.favorites.filter((entry) => entry !== key);
  const state = setEmojiFavorites(req.session.userId, nextFavorites);
  return res.json({ ok: true, favorites: state.favorites, recents: state.recents });
});

router.post('/home/emoji/recents', (req, res) => {
  const key = String(req.body.key || '').trim().slice(0, 64);
  if (!key) {
    return res.status(400).json({ ok: false, error: 'Ungültiges Emoji.' });
  }

  const state = pushRecentEmoji(req.session.userId, key);
  return res.json({ ok: true, favorites: state.favorites, recents: state.recents });
});

router.post('/home/emoji/:emojiId/delete', (req, res) => {
  const result = deleteUserEmojiForActor({
    emojiId: Number(req.params.emojiId || 0),
    actorId: req.session.userId,
    serverId: Number(req.body.serverId || 0)
  });
  if (!result.ok) {
    return res.status(result.code === 'forbidden' ? 403 : 404).json({
      ok: false,
      error: result.code === 'forbidden' ? 'Missing permission' : 'Emoji nicht gefunden.'
    });
  }

  const state = getEmojiPickerState(req.session.userId);
  return res.json({
    ok: true,
    emoji: result.emoji,
    favorites: state.favorites,
    recents: state.recents
  });
});

router.get('/home/gifs', (req, res) => {
  const q = String(req.query.q || '').trim();
  const payload = buildGifPickerPayload(req.session.userId, q);
  return res.json({
    ok: true,
    sections: payload.sections,
    favorites: payload.state.favorites,
    recents: payload.state.recents
  });
});

router.post('/home/gifs/favorites', (req, res) => {
  const gifId = Number(req.body.gifId || 0);
  const favorite = req.body.favorite !== false && req.body.favorite !== 'false' && req.body.favorite !== 0 && req.body.favorite !== '0';

  if (!gifId) {
    return res.status(400).json({ ok: false, error: 'Ungültiger Favorit.' });
  }

  const gif = listGlobalGifsByIds([gifId])[0];
  if (!gif) {
    return res.status(404).json({ ok: false, error: 'GIF nicht gefunden.' });
  }

  const current = getGifPickerState(req.session.userId);
  const nextFavorites = favorite
    ? [gifId, ...current.favorites.filter((entry) => entry !== gifId)].slice(0, 48)
    : current.favorites.filter((entry) => entry !== gifId);
  const state = setGifFavorites(req.session.userId, nextFavorites);
  return res.json({ ok: true, favorites: state.favorites, recents: state.recents });
});

router.post('/home/gifs/recents', (req, res) => {
  const gifId = Number(req.body.gifId || 0);
  if (!gifId) {
    return res.status(400).json({ ok: false, error: 'Ungültiges GIF.' });
  }

  const gif = listGlobalGifsByIds([gifId])[0];
  if (!gif) {
    return res.status(404).json({ ok: false, error: 'GIF nicht gefunden.' });
  }

  const state = pushRecentGif(req.session.userId, gifId);
  return res.json({ ok: true, favorites: state.favorites, recents: state.recents });
});

router.post('/home/gifs/:gifId/delete', (req, res) => {
  const result = deleteGifAssetForActor({
    gifId: Number(req.params.gifId || 0),
    actorId: req.session.userId,
    serverId: Number(req.body.serverId || 0)
  });
  if (!result.ok) {
    return res.status(result.code === 'forbidden' ? 403 : 404).json({
      ok: false,
      error: result.code === 'forbidden' ? 'Missing permission' : 'GIF nicht gefunden.'
    });
  }

  const state = getGifPickerState(req.session.userId);
  return res.json({
    ok: true,
    gif: result.gif,
    favorites: state.favorites,
    recents: state.recents
  });
});

router.post('/home/gifs', (req, res) => {
  const name = String(req.body.name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32);
  const tags = String(req.body.tags || '').trim();
  const description = String(req.body.description || '').trim().slice(0, 200);
  const mimeType = String(req.body.mimeType || '').toLowerCase();
  const url = String(req.body.url || '');
  const validMime = new Set(['image/gif', 'image/webp', 'video/mp4']);

  if (!name || !tags || !mimeType || !url || !validMime.has(mimeType) || !url.startsWith(`data:${mimeType};base64,`)) {
    return res.status(400).json({ ok: false, error: 'Ungültiges GIF. Datei + Name + Tags erforderlich.' });
  }

  const approxBytes = Math.ceil((url.length - (`data:${mimeType};base64,`).length) * 0.75);
  if (approxBytes > 15 * 1024 * 1024) {
    return res.status(400).json({ ok: false, error: 'GIF zu groß (max 15MB).' });
  }

  const gif = createGlobalGifAsset({
    ownerId: req.session.userId,
    name,
    tags,
    description,
    mimeType,
    fileSize: approxBytes,
    url
  });

  if (!gif) {
    const nearby = listGlobalGifAssets({ query: name, limit: 200 });
    const allNames = nearby.map((item) => item.name);
    const suggestedName = suggestAssetName(name, allNames);
    return res.status(409).json({ ok: false, error: 'Name already exists.', suggestedName });
  }

  return res.status(201).json({ ok: true, gif });
});

router.get('/friends', (req, res) => {
  const tab = ['online', 'all', 'pending', 'blocked'].includes(String(req.query.tab)) ? String(req.query.tab) : 'all';
  const rowsWithPresence = applyPresenceToCollection(listFriendsByTab(req.session.userId, tab));
  const rowsWithView = rowsWithPresence.map((row) => decorateProfileForView(row));
  const rows = tab === 'online'
    ? rowsWithView.filter((row) => row.presence !== 'offline')
    : rowsWithView;
  const servers = listServersForUser(req.session.userId);

  return res.render('pages/friends', {
    title: 'Friends',
    currentUser: req.currentUser,
    tab,
    rows,
    servers,
    selectedServer: null
  });
});

router.get('/new-server', (req, res) => {
  const servers = listServersForUser(req.session.userId);
  const discoverQuery = String(req.query.q || '').trim();
  const discoverServers = listDiscoverServersForUser(req.session.userId, discoverQuery);

  return res.render('pages/new-server', {
    title: 'New Server',
    currentUser: req.currentUser,
    servers,
    selectedServer: null,
    discoverQuery,
    discoverServers
  });
});

router.post('/new-server/create', (req, res) => {
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();

  if (!name) {
    req.flash('error', 'Server Name ist erforderlich.');
    return res.redirect('/app/new-server');
  }

  const baseSlug = slugifyServerName(name);
  const slug = uniqueServerSlug(baseSlug);
  const serverId = createServerWithDefaults({
    name,
    slug,
    description,
    ownerId: req.session.userId
  });

  req.flash('success', 'Server erstellt.');
  return res.redirect(`/app/servers/${serverId}`);
});

router.post('/new-server/join', (req, res) => {
  const serverId = Number(req.body.serverId || 0);
  if (!serverId) {
    req.flash('error', 'Ungültiger Server.');
    return res.redirect('/app/new-server');
  }

  joinServer(req.session.userId, serverId);
  req.flash('success', 'Server beigetreten.');
  return res.redirect(`/app/servers/${serverId}`);
});

router.post('/friends/request', (req, res) => {
  const handle = String(req.body.handle || '').trim();
  const target = findUserByHandle(handle, req.session.userId);

  if (!target) {
    req.flash('error', 'User nicht gefunden.');
    return res.redirect('/app/friends?tab=all');
  }

  if (!canSendFriendRequest(req.session.userId, target.id)) {
    req.flash('error', 'Diese Person erlaubt aktuell keine Anfrage von dir.');
    return res.redirect('/app/friends?tab=all');
  }

  const result = sendFriendRequest(req.session.userId, target.id);
  if (!result.ok) {
    req.flash('error', 'Freundschaftsanfrage nicht möglich: ' + result.code);
    return res.redirect('/app/friends?tab=all');
  }

  req.flash('success', result.code === 'accepted' ? 'Anfrage automatisch angenommen.' : 'Anfrage gesendet.');
  return res.redirect('/app/friends?tab=pending');
});

router.post('/friends/request/:id', (req, res) => {
  const requestId = Number(req.params.id || 0);
  const action = req.body.action === 'accept' ? 'accept' : 'decline';

  const ok = resolveFriendRequest(requestId, req.session.userId, action);
  if (!ok) {
    req.flash('error', 'Anfrage nicht gefunden.');
    return res.redirect('/app/friends?tab=pending');
  }

  req.flash('success', action === 'accept' ? 'Anfrage angenommen.' : 'Anfrage abgelehnt.');
  return res.redirect('/app/friends?tab=pending');
});

router.post('/friends/block', (req, res) => {
  const handle = String(req.body.handle || '').trim();
  const target = findUserByHandle(handle, req.session.userId);

  if (!target) {
    req.flash('error', 'User nicht gefunden.');
    return res.redirect('/app/friends?tab=blocked');
  }

  blockUser(req.session.userId, target.id);
  req.flash('success', '@' + target.username + ' blockiert.');
  return res.redirect('/app/friends?tab=blocked');
});

router.post('/friends/unblock', (req, res) => {
  const handle = String(req.body.handle || '').trim();
  const target = findUserByHandle(handle, req.session.userId);

  if (!target) {
    req.flash('error', 'User nicht gefunden.');
    return res.redirect('/app/friends?tab=blocked');
  }

  unblockUser(req.session.userId, target.id);
  req.flash('success', '@' + target.username + ' entblockt.');
  return res.redirect('/app/friends?tab=blocked');
});

const settingsSections = [
  'my-account',
  'profile',
  'privacy-safety',
  'notifications',
  'connections',
  'appearance',
  'accessibility',
  'voice-video',
  'lan-access',
  'language',
  'ai'
];

function normalizeSettingsSection(value) {
  const section = String(value || '').trim();
  return settingsSections.includes(section) ? section : 'my-account';
}

router.get('/settings/verify-email/:token', (req, res) => {
  const ok = applyEmailVerificationToken(req.params.token);
  if (!ok) {
    req.flash('error', 'Email-Verifizierung fehlgeschlagen oder abgelaufen.');
    return res.redirect('/app/settings/my-account');
  }

  req.flash('success', 'Email erfolgreich verifiziert und geändert.');
  return res.redirect('/app/settings/my-account');
});

router.get('/settings/:section?', (req, res) => {
  const section = normalizeSettingsSection(req.params.section);
  const state = getGlobalSettingsState(req.session.userId);
  const blocked = listFriendsByTab(req.session.userId, 'blocked');
  const servers = listServersForUser(req.session.userId);
  const aiAvailability = getSokratesAvailability({ userSettings: state.settings });
  const aboutPlusBuilder = section === 'profile'
    ? buildAboutPlusForViewer(req.session.userId, state.user)
    : null;

  return res.render('pages/settings', {
    title: 'Settings',
    currentUser: req.currentUser,
    section,
    sections: settingsSections,
    account: state.user,
    settings: state.settings,
    aboutPlusBuilder,
    aiAvailability,
    blocked,
    servers,
    selectedServer: null
  });
});

router.get('/settings/privacy', (_req, res) => res.redirect('/app/settings/privacy-safety'));
router.get('/settings/lan', (_req, res) => res.redirect('/app/settings/lan-access'));

router.post('/settings/:section/save', async (req, res) => {
  const section = normalizeSettingsSection(req.params.section);

  if (section === 'my-account') {
    const action = String(req.body.accountAction || 'identity');

    if (action === 'identity') {
      const result = updateAccountIdentity(req.session.userId, {
        username: req.body.username,
        email: req.body.email
      });

      if (!result.ok) {
        req.flash('error', `Account-Update fehlgeschlagen: ${result.code}`);
        return res.redirect('/app/settings/my-account');
      }

      if (result.emailChanged) {
        req.flash('info', `Dev Verify Link: /app/settings/verify-email/${result.emailVerificationToken}`);
      }
      req.flash('success', 'Account-Daten gespeichert.');
      return res.redirect('/app/settings/my-account');
    }

    if (action === 'password') {
      const newPassword = String(req.body.newPassword || '');
      const confirmPassword = String(req.body.confirmPassword || '');
      if (newPassword !== confirmPassword) {
        req.flash('error', 'Passwörter stimmen nicht überein.');
        return res.redirect('/app/settings/my-account');
      }

      const result = changeUserPassword(req.session.userId, {
        currentPassword: req.body.currentPassword,
        newPassword
      });

      if (!result.ok) {
        req.flash('error', `Passwortwechsel fehlgeschlagen: ${result.code}`);
        return res.redirect('/app/settings/my-account');
      }

      req.flash('success', 'Passwort geändert.');
      return res.redirect('/app/settings/my-account');
    }

    if (action === 'logout-others') {
      const version = incrementSessionVersion(req.session.userId);
      req.session.sessionVersion = version;
      req.flash('success', 'Alle anderen Sessions wurden ausgeloggt.');
      return res.redirect('/app/settings/my-account');
    }

    if (action === 'deactivate') {
      markDisconnected(req.session.userId, {
        manualStatus: req.currentUser?.presence_status || 'online'
      });
      deactivateUserAccount(req.session.userId);
      req.session.destroy(() => {});
      return res.redirect('/login');
    }

    if (action === 'delete') {
      markDisconnected(req.session.userId, {
        manualStatus: req.currentUser?.presence_status || 'online'
      });
      deleteUserAccount(req.session.userId);
      req.session.destroy(() => {});
      return res.redirect('/login');
    }
  }

  if (section === 'profile') {
    const state = getGlobalSettingsState(req.session.userId);
    const currentAvatar = state.user?.avatar_url || '';
    const currentBanner = state.user?.banner_url || '';
    const avatarData = String(req.body.avatarData || '').trim();
    const bannerData = String(req.body.bannerData || '').trim();
    const avatarRemove = req.body.avatarRemove === '1';
    const bannerRemove = req.body.bannerRemove === '1';

    let avatarUrl = avatarRemove ? '' : currentAvatar;
    let bannerUrl = bannerRemove ? '' : currentBanner;
    let aboutPlusRaw = {};

    try {
      if (!avatarRemove && avatarData) {
        avatarUrl = persistProfileDataUrlAsset(avatarData, {
          userId: req.session.userId,
          kind: 'avatar',
          maxBytes: ABOUT_PLUS_IMAGE_MAX_BYTES
        });
      }
      if (!bannerRemove && bannerData) {
        bannerUrl = persistProfileDataUrlAsset(bannerData, {
          userId: req.session.userId,
          kind: 'banner',
          maxBytes: PROFILE_PHOTO_MAX_BYTES
        });
      }
      aboutPlusRaw = JSON.parse(String(req.body.aboutPlusJson || '{}') || '{}');
    } catch (_error) {
      req.flash('error', 'Profil, Banner oder About+ konnten nicht gespeichert werden.');
      return res.redirect('/app/settings/profile');
    }

    const currentAboutPlus = normalizeAboutPlusPayload(getUserProfileExtras(req.session.userId), buildDefaultAboutPlus(state.user));
    const nextAboutPlus = normalizeAboutPlusPayload(aboutPlusRaw, currentAboutPlus);

    try {
      nextAboutPlus.fields = nextAboutPlus.fields.map((field, index) => {
        if (field.type !== 'media_card' && field.template_key !== 'favorite_food') {
          return normalizeAboutPlusField(field, index, field);
        }
        if (field.type === 'media_card') {
          const nextValue = field.value && typeof field.value === 'object' && !Array.isArray(field.value)
            ? { ...field.value }
            : { items: [] };
          nextValue.items = getAboutPlusMediaCardItems(nextValue).map((item) => {
            const nextItem = { ...item };
            if (String(nextItem.data_url || '').startsWith('data:')) {
              nextItem.file_url = persistProfileDataUrlAsset(nextItem.data_url, {
                userId: req.session.userId,
                kind: 'about-plus-media',
                maxBytes: ABOUT_PLUS_IMAGE_MAX_BYTES
              });
              nextItem.data_url = '';
            }
            return normalizeAboutPlusMediaValue(nextItem, field.max_length || 160);
          }).slice(0, 3);
          return normalizeAboutPlusField({
            ...field,
            value: nextValue
          }, index, field);
        }
        const media = field.media && typeof field.media === 'object' ? { ...field.media } : {};
        if (String(media.data_url || '').startsWith('data:')) {
          media.file_url = persistProfileDataUrlAsset(media.data_url, {
            userId: req.session.userId,
            kind: 'about-plus-food',
            maxBytes: ABOUT_PLUS_IMAGE_MAX_BYTES
          });
          media.data_url = '';
        }
        return normalizeAboutPlusField({
          ...field,
          media
        }, index, field);
      });
      nextAboutPlus.fields = await attachFavoriteGameCoverToAboutPlusFields(req.session.userId, nextAboutPlus.fields);
    } catch (_error) {
      req.flash('error', 'About+-Medien konnten nicht gespeichert werden.');
      return res.redirect('/app/settings/profile');
    }

    updateUserProfileSettings(req.session.userId, {
      displayName: req.body.displayName,
      aboutMe: req.body.aboutMe,
      avatarUrl,
      bannerUrl,
      presenceStatus: req.body.presenceStatus,
      customStatusEmoji: req.body.customStatusEmoji,
      customStatusText: req.body.customStatusText,
      customStatusExpiresAt: req.body.customStatusExpiresAt
    });
    upsertUserProfileExtras(req.session.userId, nextAboutPlus);
    syncManualPresence(req.session.userId, req.body.presenceStatus);
    req.flash('success', 'Profil gespeichert.');
    return res.redirect('/app/settings/profile');
  }

  if (section === 'privacy-safety') {
    const dmPermission = ['all', 'server_members', 'friends'].includes(req.body.dmPermission)
      ? req.body.dmPermission
      : 'all';
    const friendRequestPermission = ['everyone', 'friends_of_friends', 'server_members'].includes(req.body.friendRequestPermission)
      ? req.body.friendRequestPermission
      : 'everyone';
    const messageRequestsEnabled = req.body.messageRequestsEnabled === 'on';
    const blockHistoryMode = ['visible', 'hidden'].includes(req.body.blockHistoryMode)
      ? req.body.blockHistoryMode
      : 'visible';

    updateUserSettings(req.session.userId, {
      dmPermission,
      friendRequestPermission,
      messageRequestsEnabled,
      blockHistoryMode
    });
    req.flash('success', 'Privacy & Safety gespeichert.');
    return res.redirect('/app/settings/privacy-safety');
  }

  if (section === 'notifications') {
    updateNotificationSettings(req.session.userId, {
      desktopPush: req.body.desktopPush === 'on',
      soundsEnabled: req.body.soundsEnabled === 'on',
      mentionsMode: req.body.mentionsMode
    });
    req.flash('success', 'Notifications gespeichert.');
    return res.redirect('/app/settings/notifications');
  }

  if (section === 'appearance') {
    updateAppearanceSettings(req.session.userId, {
      theme: req.body.theme,
      fontScale: req.body.fontScale,
      density: req.body.density,
      avatarGrouping: req.body.avatarGrouping,
      reducedMotion: req.body.reducedMotion === 'on'
    });
    req.flash('success', 'Appearance gespeichert.');
    return res.redirect('/app/settings/appearance');
  }

  if (section === 'accessibility') {
    updateAccessibilitySettings(req.session.userId, {
      screenReaderHints: req.body.screenReaderHints === 'on',
      highContrast: req.body.highContrast === 'on'
    });
    req.flash('success', 'Accessibility gespeichert.');
    return res.redirect('/app/settings/accessibility');
  }

  if (section === 'voice-video') {
    updateVoiceVideoSettings(req.session.userId, {
      inputDevice: req.body.inputDevice,
      outputDevice: req.body.outputDevice,
      inputSensitivity: req.body.inputSensitivity,
      echoCancellation: req.body.echoCancellation === 'on',
      noiseSuppression: req.body.noiseSuppression === 'on',
      cameraDevice: req.body.cameraDevice,
      pttKey: req.body.pttKey
    });
    req.flash('success', 'Voice & Video gespeichert.');
    return res.redirect('/app/settings/voice-video');
  }

  if (section === 'language') {
    updateLanguageSettings(req.session.userId, req.body.language);
    req.flash('success', 'Sprache gespeichert.');
    return res.redirect('/app/settings/language');
  }

  if (section === 'ai') {
    updateAiProviderSettings(req.session.userId, {
      providerMode: req.body.providerMode,
      openaiModel: req.body.openaiModel,
      ollamaModel: req.body.ollamaModel
    });
    req.flash('success', 'AI-Provider gespeichert.');
    return res.redirect('/app/settings/ai');
  }

  if (section === 'connections') {
    const lines = String(req.body.connections || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    updateConnections(req.session.userId, lines);
    req.flash('success', 'Connections gespeichert.');
    return res.redirect('/app/settings/connections');
  }

  req.flash('error', 'Unbekannte Settings-Sektion.');
  return res.redirect('/app/settings/my-account');
});

router.get('/servers/:serverId', (req, res) => {
  const serverId = Number(req.params.serverId);
  const servers = listServersForUser(req.session.userId);
  const selectedServer = servers.find((s) => s.id === serverId);

  if (!selectedServer) {
    return res.status(404).render('pages/error', {
      title: 'Server fehlt',
      code: 404,
      message: 'Server nicht gefunden oder kein Zugriff.',
      currentUser: req.currentUser
    });
  }

  const channels = listChannelsForServer(serverId);
  const categories = listServerCategories(serverId);
  const selectedChannelId = Number(req.query.channel || channels[0]?.id || 0);
  const selectedChannel = channels.find((ch) => ch.id === selectedChannelId) || channels[0] || null;
  const selectedTextChannel = selectedChannel && selectedChannel.type === 'text'
    ? selectedChannel
    : (channels.find((channel) => channel.type === 'text') || null);
  const channelMessages = selectedTextChannel ? applyPresenceToMessages(listMessagesForChannel(selectedTextChannel.id, 200)) : [];
  const channelCanPost = Boolean(selectedTextChannel);
  const members = applyPresenceToCollection(listMembersForServer(serverId))
    .map((member) => decorateProfileForView(member));
  const onlineMembers = members.filter((member) => member.presence !== 'offline');
  const offlineMembers = members.filter((member) => member.presence === 'offline');
  const memberCount = members.length;
  const myServerMember = members.find((member) => member.id === req.session.userId) || null;
  const isServerAdmin = Boolean(myServerMember && (myServerMember.role === 'owner' || myServerMember.role === 'admin'));
  const isServerOwner = Boolean(myServerMember && myServerMember.role === 'owner');
  const canManageChannels = canManageServer(serverId, req.session.userId);
  const canInvitePeople = canInviteToServer(serverId, req.session.userId);
  const canManageSokratesApp = canManageChannels;
  const notificationSettings = getServerNotificationSettings(serverId, req.session.userId);
  const privacySettings = getServerPrivacySettings(serverId, req.session.userId);
  const activeInvites = canInvitePeople ? listActiveServerInvites(serverId, req.session.userId) : [];
  const ownerTransferCandidates = members.filter((member) => member.id !== req.session.userId);
  const voiceChannels = channels.filter((channel) => channel.type === 'voice');
  const liveVoicePresence = decorateVoicePresenceChannels(getServerVoicePresence(serverId, voiceChannels));
  const liveVoicePresenceByChannel = new Map(liveVoicePresence.map((entry) => [Number(entry.id), entry]));
  const sokratesServerInstallation = getServerAppInstallation(serverId, SOKRATES_SERVER_APP_ID);
  const sokratesServerApp = buildSokratesServerAppView(
    sokratesServerInstallation,
    channels.filter((channel) => channel.type === 'text')
  );
  const userEmojis = listAvailableCustomEmojis(req.session.userId);
  const emojiPickerState = getEmojiPickerState(req.session.userId);
  const voiceBootstrap = {
    serverId,
    serverName: selectedServer.name,
    secureOriginRequired: isVoiceSecureOriginRequired(req),
    secureOriginReady: isVoiceRequestSecure(req),
    realtimePath: String(req.app?.locals?.network?.voiceRealtimePath || '/app/voice/realtime'),
    turnRequired: isVoiceTurnRequired(req),
    turnConfigured: isVoiceTurnConfigured(req),
    iceServers: getVoiceIceServers(req),
    httpsEnabled: Boolean(req.app?.locals?.network?.httpsEnabled),
    httpsPort: Number(req.app?.locals?.network?.httpsPort || process.env.HTTPS_PORT || 3443),
    externalHttpsBaseUrl: String(req.app?.locals?.network?.externalHttpsBaseUrl || ''),
    currentUserId: req.session.userId,
    selectedChannelId: selectedChannel ? selectedChannel.id : null,
    selectedChannelType: selectedChannel ? selectedChannel.type : '',
    fallbackTextChannelId: selectedTextChannel ? selectedTextChannel.id : null,
    permissions: {
      canJoinVoice: Boolean(myServerMember),
      canSpeak: Boolean(myServerMember)
    },
    channels: voiceChannels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      topic: channel.topic || '',
      participants: liveVoicePresenceByChannel.get(Number(channel.id))?.participants || []
    }))
  };

  return res.render('pages/server', {
    title: selectedServer.name,
    currentUser: req.currentUser,
    servers,
    selectedServer,
    categories,
    channels,
    selectedChannel,
    selectedTextChannel,
    channelMessages,
    channelCanPost,
    members,
    onlineMembers,
    offlineMembers,
    memberCount,
    isServerAdmin,
    isServerOwner,
    canManageSokratesApp,
    canModerateMessages: canManageChannels,
    canManageChannels,
    canInvitePeople,
    notificationSettings,
    privacySettings,
    activeInvites,
    ownerTransferCandidates,
    sokratesServerApp,
    userEmojis,
    emojiPickerState,
    voiceBootstrap
  });
});

router.get('/invite/:token', (req, res) => {
  const result = useServerInviteToken(req.params.token, req.session.userId);
  if (!result.ok) {
    const map = {
      invalid_token: 'Invite-Link ist ungültig.',
      expired: 'Invite-Link ist abgelaufen.',
      exhausted: 'Invite-Link wurde bereits zu oft verwendet.'
    };
    req.flash('error', map[result.code] || 'Invite-Link konnte nicht eingelöst werden.');
    return res.redirect('/app/new-server');
  }
  req.flash('success', result.alreadyMember ? 'Du bist bereits auf diesem Server.' : 'Server beigetreten.');
  return res.redirect(`/app/servers/${result.serverId}`);
});

router.get('/servers/:serverId/settings', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const membership = getServerMembership(serverId, req.session.userId);
  if (!membership) {
    req.flash('error', 'Server nicht gefunden oder kein Zugriff.');
    return res.redirect('/app/home');
  }
  if (!canManageServer(serverId, req.session.userId)) {
    req.flash('error', 'Keine Berechtigung für Server Settings.');
    return res.redirect(`/app/servers/${serverId}`);
  }
  const servers = listServersForUser(req.session.userId);
  const section = normalizeServerSettingsSection(req.query.section);
  const channels = listChannelsForServer(serverId);
  const textChannels = channels.filter((channel) => channel.type === 'text');
  const categories = listServerCategories(serverId);
  const members = applyPresenceToCollection(listMembersForServer(serverId));
  const onlineCount = members.filter((member) => ['online', 'idle', 'dnd', 'streaming'].includes(member.presence)).length;
  const canManageSokratesApp = canManageServer(serverId, req.session.userId);
  const sokratesServerInstallation = getServerAppInstallation(serverId, SOKRATES_SERVER_APP_ID);
  const sokratesServerApp = buildSokratesServerAppView(
    sokratesServerInstallation,
    textChannels
  );
  const preview = {
    memberCount: members.length,
    onlineCount
  };
  return res.render('pages/server-settings', {
    title: `${membership.name} Settings`,
    currentUser: req.currentUser,
    servers,
    selectedServer: membership,
    server: membership,
    section,
    settingsSections: SERVER_SETTINGS_SECTIONS,
    channels,
    textChannels,
    categories,
    preview,
    canManageSokratesApp,
    sokratesServerApp
  });
});

router.post('/servers/:serverId/settings/overview', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const membership = getServerMembership(serverId, req.session.userId);
  if (!membership) {
    req.flash('error', 'Server nicht gefunden oder kein Zugriff.');
    return res.redirect('/app/home');
  }

  const iconData = String(req.body.iconData || '').trim();
  const bannerData = String(req.body.bannerData || '').trim();
  const iconRemove = req.body.iconRemove === '1';
  const bannerRemove = req.body.bannerRemove === '1';
  let iconUrl = iconRemove ? '' : String(membership.icon_url || '').trim();
  let bannerUrl = bannerRemove ? '' : String(membership.banner_url || '').trim();

  try {
    if (!iconRemove && iconData) {
      iconUrl = persistServerDataUrlAsset(iconData, {
        serverId,
        kind: 'icon',
        maxBytes: SERVER_ICON_MAX_BYTES
      });
    }
    if (!bannerRemove && bannerData) {
      bannerUrl = persistServerDataUrlAsset(bannerData, {
        serverId,
        kind: 'banner',
        maxBytes: SERVER_BANNER_MAX_BYTES
      });
    }
  } catch (error) {
    const code = String(error?.message || '').toLowerCase();
    const map = {
      invalid_data_url: 'Upload konnte nicht gelesen werden.',
      unsupported_media_type: 'Ungültiger Dateityp. Erlaubt: PNG/JPG/WEBP/GIF.',
      file_too_large: 'Datei zu groß.',
      empty_upload: 'Leere Datei.'
    };
    req.flash('error', map[code] || 'Server-Asset konnte nicht gespeichert werden.');
    return res.redirect(`/app/servers/${serverId}/settings?section=overview`);
  }

  const result = updateServerOverview(serverId, req.session.userId, {
    name: req.body.name,
    description: req.body.description,
    iconUrl,
    bannerUrl,
    accentColor: req.body.accentColor,
    traits: req.body.traits
  });
  if (!result.ok) {
    req.flash('error', 'Server konnte nicht aktualisiert werden.');
    return res.redirect(`/app/servers/${serverId}/settings?section=overview`);
  }
  req.flash('success', 'Server-Profil gespeichert.');
  return res.redirect(`/app/servers/${serverId}/settings?section=overview`);
});

router.post('/servers/:serverId/settings/channels/create', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const result = createServerChannel({
    serverId,
    type: req.body.type,
    name: req.body.name,
    topic: req.body.topic,
    categoryId: req.body.categoryId,
    actorId: req.session.userId
  });

  if (!result.ok) {
    const map = {
      permission_denied: 'Keine Berechtigung.',
      name_required: 'Channel-Name fehlt.',
      name_exists: 'Channel-Name existiert bereits.',
      category_invalid: 'Kategorie ist ungültig.'
    };
    req.flash('error', map[result.code] || 'Channel konnte nicht erstellt werden.');
    return res.redirect(`/app/servers/${serverId}/settings?section=channels`);
  }

  req.flash('success', `Channel #${result.channel.name} erstellt.`);
  return res.redirect(`/app/servers/${serverId}/settings?section=channels`);
});

router.post('/servers/:serverId/settings/channels/:channelId/update', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const channelId = Number(req.params.channelId || 0);
  const result = updateServerChannel({
    serverId,
    channelId,
    name: req.body.name,
    topic: req.body.topic,
    categoryId: req.body.categoryId,
    actorId: req.session.userId
  });

  if (!result.ok) {
    const map = {
      permission_denied: 'Keine Berechtigung.',
      channel_not_found: 'Channel nicht gefunden.',
      name_required: 'Channel-Name fehlt.',
      name_exists: 'Channel-Name existiert bereits.',
      category_invalid: 'Kategorie ist ungültig.'
    };
    req.flash('error', map[result.code] || 'Channel konnte nicht aktualisiert werden.');
    return res.redirect(`/app/servers/${serverId}/settings?section=channels`);
  }

  req.flash('success', `Channel #${result.channel.name} gespeichert.`);
  return res.redirect(`/app/servers/${serverId}/settings?section=channels`);
});

router.post('/servers/:serverId/settings/channels/:channelId/delete', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const channelId = Number(req.params.channelId || 0);
  const result = deleteServerChannel({
    serverId,
    channelId,
    actorId: req.session.userId
  });

  if (!result.ok) {
    const map = {
      permission_denied: 'Keine Berechtigung.',
      channel_not_found: 'Channel nicht gefunden.'
    };
    req.flash('error', map[result.code] || 'Channel konnte nicht gelöscht werden.');
    return res.redirect(`/app/servers/${serverId}/settings?section=channels`);
  }

  req.flash('success', 'Channel gelöscht.');
  return res.redirect(`/app/servers/${serverId}/settings?section=channels`);
});

router.post('/servers/:serverId/settings/categories/create', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const result = createServerCategory({
    serverId,
    name: req.body.name,
    actorId: req.session.userId
  });

  if (!result.ok) {
    const map = {
      permission_denied: 'Keine Berechtigung.',
      name_required: 'Kategorie-Name fehlt.',
      name_exists: 'Kategorie existiert bereits.'
    };
    req.flash('error', map[result.code] || 'Kategorie konnte nicht erstellt werden.');
    return res.redirect(`/app/servers/${serverId}/settings?section=categories`);
  }

  req.flash('success', `Kategorie ${result.category.name} erstellt.`);
  return res.redirect(`/app/servers/${serverId}/settings?section=categories`);
});

router.post('/servers/:serverId/invites', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const result = createServerInvite({
    serverId,
    actorId: req.session.userId,
    expiresOption: req.body.expiresOption,
    maxUses: Number(req.body.maxUses || 0),
    requireVerification: req.body.requireVerification === true || req.body.requireVerification === '1' || req.body.requireVerification === 'on'
  });
  if (!result.ok) {
    return res.status(result.code === 'permission_denied' ? 403 : 400).json({ ok: false, error: result.code });
  }
  const inviteUrl = `${req.protocol}://${req.get('host')}/app/invite/${result.invite.token}`;
  return res.status(201).json({ ok: true, invite: { ...result.invite, url: inviteUrl } });
});

router.post('/servers/:serverId/settings/notifications', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const result = updateServerNotificationSettings(serverId, req.session.userId, {
    muteDuration: req.body.muteDuration,
    notificationLevel: req.body.notificationLevel,
    suppressEveryone: req.body.suppressEveryone === true || req.body.suppressEveryone === '1' || req.body.suppressEveryone === 'on',
    suppressHere: req.body.suppressHere === true || req.body.suppressHere === '1' || req.body.suppressHere === 'on'
  });
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.code });
  }
  return res.json({ ok: true, settings: result.settings });
});

router.post('/servers/:serverId/settings/privacy', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const result = updateServerPrivacySettings(serverId, req.session.userId, {
    dmPermission: req.body.dmPermission,
    explicitFilter: req.body.explicitFilter
  });
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.code });
  }
  return res.json({ ok: true, settings: result.settings });
});

router.post('/servers/:serverId/channels', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const result = createServerChannel({
    serverId,
    type: req.body.type,
    name: req.body.name,
    topic: req.body.topic,
    categoryId: req.body.categoryId,
    actorId: req.session.userId
  });
  if (!result.ok) {
    return res.status(result.code === 'permission_denied' ? 403 : 400).json({ ok: false, error: result.code });
  }
  return res.status(201).json({
    ok: true,
    channel: result.channel,
    redirectUrl: `/app/servers/${serverId}?channel=${result.channel.id}`
  });
});

router.post('/servers/:serverId/categories', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const result = createServerCategory({
    serverId,
    name: req.body.name,
    actorId: req.session.userId
  });
  if (!result.ok) {
    return res.status(result.code === 'permission_denied' ? 403 : 400).json({ ok: false, error: result.code });
  }
  return res.status(201).json({ ok: true, category: result.category });
});

router.post('/servers/:serverId/voice/join', (req, res) => {
  if (!isVoiceRequestSecure(req)) {
    return res.status(400).json({
      ok: false,
      error: 'voice_requires_https',
      message: 'Voice requires HTTPS when connecting over LAN.'
    });
  }
  if (isVoiceTurnRequired(req) && !isVoiceTurnConfigured(req)) {
    return res.status(503).json({
      ok: false,
      error: 'turn_required',
      message: 'Voice requires TURN configuration on this server.'
    });
  }
  const serverId = Number(req.params.serverId || 0);
  const channelId = Number(req.body.channelId || 0);
  const context = resolveVoiceChannelContext(serverId, req.session.userId, channelId);
  if (!context.ok) {
    return res.status(context.code === 'not_member' ? 403 : 404).json({ ok: false, error: context.code });
  }
  const voiceChannels = listChannelsForServer(serverId).filter((entry) => entry.type === 'voice');

  const canSpeak = Boolean(context.membership);
  const result = createVoiceSession({
    serverId,
    channelId,
    userId: req.session.userId,
    displayName: req.currentUser?.display_name || req.currentUser?.username || 'User',
    avatarUrl: req.currentUser?.avatar_url || '',
    status: req.currentUser?.effective_presence || req.currentUser?.presence_status || 'online',
    canSpeak
  });

  return res.status(201).json({
    ok: true,
    sessionId: result.sessionId,
    room: {
      server_id: serverId,
      voice_channel_id: channelId
    },
    permissions: {
      canJoinVoice: true,
      canSpeak
    },
    participants: result.participants.map((participant) => applyPresenceToVoiceParticipant(participant)),
    serverPresence: decorateVoicePresenceChannels(getServerVoicePresence(serverId, voiceChannels))
  });
});

router.post('/servers/:serverId/voice/sync', (req, res) => {
  if (!isVoiceRequestSecure(req)) {
    return res.status(400).json({ ok: false, error: 'voice_requires_https' });
  }
  const serverId = Number(req.params.serverId || 0);
  if (!getServerMembership(serverId, req.session.userId)) {
    return res.status(403).json({ ok: false, error: 'not_member' });
  }
  const voiceChannels = listChannelsForServer(serverId).filter((entry) => entry.type === 'voice');
  const result = syncVoiceSession({
    sessionId: req.body.sessionId,
    userId: req.session.userId,
    muted: typeof req.body.muted === 'boolean' ? req.body.muted : undefined,
    deafened: typeof req.body.deafened === 'boolean' ? req.body.deafened : undefined
  });
  if (!result.ok) {
    return res.status(404).json({ ok: false, error: result.code });
  }
  result.participants = Array.isArray(result.participants)
    ? result.participants.map((participant) => applyPresenceToVoiceParticipant(participant))
    : [];
  result.serverPresence = decorateVoicePresenceChannels(getServerVoicePresence(serverId, voiceChannels));
  return res.json(result);
});

router.post('/servers/:serverId/voice/state', (req, res) => {
  if (!isVoiceRequestSecure(req)) {
    return res.status(400).json({ ok: false, error: 'voice_requires_https' });
  }
  const serverId = Number(req.params.serverId || 0);
  if (!getServerMembership(serverId, req.session.userId)) {
    return res.status(403).json({ ok: false, error: 'not_member' });
  }
  const result = updateVoiceState({
    sessionId: req.body.sessionId,
    userId: req.session.userId,
    speaking: Boolean(req.body.speaking),
    audioLevel: Number(req.body.audioLevel || 0),
    muted: typeof req.body.muted === 'boolean' ? req.body.muted : undefined,
    deafened: typeof req.body.deafened === 'boolean' ? req.body.deafened : undefined
  });
  if (!result.ok) {
    return res.status(404).json({ ok: false, error: result.code });
  }
  result.participant = applyPresenceToVoiceParticipant(result.participant);
  return res.json(result);
});

router.post('/servers/:serverId/voice/signal', (req, res) => {
  if (!isVoiceRequestSecure(req)) {
    return res.status(400).json({ ok: false, error: 'voice_requires_https' });
  }
  const serverId = Number(req.params.serverId || 0);
  if (!getServerMembership(serverId, req.session.userId)) {
    return res.status(403).json({ ok: false, error: 'not_member' });
  }
  const result = queueVoiceSignal({
    sessionId: req.body.sessionId,
    userId: req.session.userId,
    targetSessionId: req.body.targetSessionId,
    description: req.body.description,
    candidate: req.body.candidate
  });
  if (!result.ok) {
    return res.status(404).json({ ok: false, error: result.code });
  }
  return res.json({ ok: true });
});

router.post('/servers/:serverId/voice/leave', (req, res) => {
  if (!isVoiceRequestSecure(req)) {
    return res.status(400).json({ ok: false, error: 'voice_requires_https' });
  }
  const serverId = Number(req.params.serverId || 0);
  if (!getServerMembership(serverId, req.session.userId)) {
    return res.status(403).json({ ok: false, error: 'not_member' });
  }
  const result = leaveVoiceSession({
    sessionId: req.body.sessionId,
    userId: req.session.userId
  });
  if (!result.ok) {
    return res.status(404).json({ ok: false, error: result.code });
  }
  return res.json({ ok: true });
});

router.get('/servers/:serverId/voice/presence', (req, res) => {
  if (!isVoiceRequestSecure(req)) {
    return res.status(400).json({ ok: false, error: 'voice_requires_https' });
  }
  const serverId = Number(req.params.serverId || 0);
  if (!getServerMembership(serverId, req.session.userId)) {
    return res.status(403).json({ ok: false, error: 'not_member' });
  }
  const voiceChannels = listChannelsForServer(serverId).filter((entry) => entry.type === 'voice');
  return res.json({
    ok: true,
    channels: decorateVoicePresenceChannels(getServerVoicePresence(serverId, voiceChannels))
  });
});

router.post('/servers/:serverId/mark-read', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const result = markServerRead(serverId, req.session.userId);
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.code });
  }
  return res.json({ ok: true, snapshot: result.snapshot });
});

router.post('/servers/:serverId/mark-read/undo', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const result = undoServerMarkRead(serverId, req.session.userId, req.body.snapshot);
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.code });
  }
  return res.json({ ok: true });
});

router.post('/servers/:serverId/apps/sokrates', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const membership = getServerMembership(serverId, req.session.userId);
  if (!membership) {
    return res.status(404).json({ ok: false, error: 'not_member' });
  }
  if (!canManageServer(serverId, req.session.userId)) {
    return res.status(403).json({ ok: false, error: 'permission_denied' });
  }

  const textChannels = listChannelsForServer(serverId).filter((channel) => channel.type === 'text');
  const channelIds = textChannels.map((channel) => Number(channel.id || 0)).filter(Boolean);
  const reactionPool = Array.isArray(req.body.reactionPool)
    ? req.body.reactionPool
    : String(req.body.reactionPool || '')
      .split(/[,\s]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  const rawCooldownMs = Number(req.body.channel_cooldown_ms || 0);
  const cooldownMinutes = Number(req.body.channelCooldownMinutes ?? req.body.channel_cooldown_minutes ?? 0);
  const settings = normalizeSokratesServerSettings({
    enabled: req.body.enabled,
    reaction_rate: req.body.reactionRate ?? req.body.reaction_rate,
    reply_rate: req.body.replyRate ?? req.body.reply_rate,
    provider_unavailable_behavior: req.body.providerUnavailableBehavior ?? req.body.provider_unavailable_behavior,
    allow_text: req.body.allowText ?? req.body.allow_text,
    allow_reactions: req.body.allowReactions ?? req.body.allow_reactions,
    channel_scope: req.body.channelScope ?? req.body.channel_scope,
    channels_allowlist: req.body.channelsAllowlist ?? req.body.channels_allowlist,
    probability_preset: req.body.probabilityPreset ?? req.body.probability_preset,
    channel_cooldown_ms: rawCooldownMs > 0 ? rawCooldownMs : cooldownMinutes * 60 * 1000,
    server_hour_cap: req.body.serverHourCap ?? req.body.server_hour_cap,
    reaction_pool: reactionPool
  }, { channelIds });

  const installation = upsertServerAppInstallation({
    serverId,
    appId: SOKRATES_SERVER_APP_ID,
    actorId: req.session.userId,
    settings
  });

  if (!installation) {
    return res.status(500).json({ ok: false, error: 'save_failed' });
  }

  return res.json({
    ok: true,
    installation: buildSokratesServerAppView(installation, textChannels)
  });
});

router.post('/servers/:serverId/apps/sokrates/remove', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const membership = getServerMembership(serverId, req.session.userId);
  if (!membership) {
    return res.status(404).json({ ok: false, error: 'not_member' });
  }
  if (!canManageServer(serverId, req.session.userId)) {
    return res.status(403).json({ ok: false, error: 'permission_denied' });
  }

  const removed = removeServerAppInstallation(serverId, SOKRATES_SERVER_APP_ID);
  return res.json({ ok: true, removed });
});

router.post('/servers/:serverId/leave', (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const result = leaveServer(serverId, req.session.userId, req.body.transferOwnerId);
  if (!result.ok) {
    return res.status(result.code === 'not_member' ? 404 : 400).json({ ok: false, error: result.code });
  }
  return res.json({ ok: true, redirectUrl: '/app/home' });
});

router.post('/messages/:messageId/delete', (req, res) => {
  const messageId = Number(req.params.messageId || 0);
  const result = deleteMessageForActor(messageId, req.session.userId);
  if (!result.ok) {
    return buildJsonMessageActionError(res, result.code === 'forbidden' ? 403 : 404, 'Nachricht konnte nicht gelöscht werden.');
  }
  return res.json({
    ok: true,
    messageId
  });
});

router.post('/messages/:messageId/report', (req, res) => {
  const messageId = Number(req.params.messageId || 0);
  const context = findMessageActionContext(messageId);
  if (!context) {
    return buildJsonMessageActionError(res, 404, 'Nachricht nicht gefunden.');
  }

  const allowed = context.thread_id
    ? Boolean(findThreadByIdForUser(context.thread_id, req.session.userId))
    : Boolean(context.server_id && getServerMembership(context.server_id, req.session.userId));

  if (!allowed) {
    return buildJsonMessageActionError(res, 403, 'Kein Zugriff auf diese Nachricht.');
  }

  console.warn(JSON.stringify({
    event: 'message.report',
    ts: new Date().toISOString(),
    message_id: messageId,
    actor_id: req.session.userId,
    thread_id: Number(context.thread_id || 0) || null,
    channel_id: Number(context.channel_id || 0) || null
  }));

  return res.json({
    ok: true,
    messageId
  });
});

router.post('/servers/:serverId/message', async (req, res) => {
  const serverId = Number(req.params.serverId || 0);
  const channelId = Number(req.body.channelId || 0);
  const editMessageId = Number(req.body.editMessageId || 0);
  const replyToMessageId = Number(req.body.replyToMessageId || 0);
  const payload = parseComposerPayload(req.body);
  const content = payload.text;

  const servers = listServersForUser(req.session.userId);
  const selectedServer = servers.find((s) => s.id === serverId);
  if (!selectedServer) {
    if (req.accepts('json') && req.is('application/json')) {
      return res.status(404).json({ ok: false, error: 'Server nicht gefunden oder kein Zugriff.' });
    }
    return res.redirect('/app/home');
  }

  const channels = listChannelsForServer(serverId);
  const channel = channels.find((ch) => ch.id === channelId);
  if (!channel || channel.type !== 'text') {
    if (req.accepts('json') && req.is('application/json')) {
      return res.status(403).json({ ok: false, error: 'Kein Schreibzugriff in diesem Channel.' });
    }
    return res.redirect(`/app/servers/${serverId}`);
  }

  const replyTarget = resolveReplyTargetForCompose({
    replyToMessageId,
    channelId,
    actorId: req.session.userId
  });
  if (!replyTarget.ok) {
    if (req.accepts('json') && req.is('application/json')) {
      return buildJsonMessageActionError(res, 400, 'Reply-Ziel ist ungültig.');
    }
    return res.redirect(`/app/servers/${serverId}?channel=${channelId}`);
  }

  if (editMessageId) {
    const editContext = findMessageActionContext(editMessageId);
    if (!editContext || Number(editContext.channel_id || 0) !== channelId) {
      if (req.accepts('json') && req.is('application/json')) {
        return buildJsonMessageActionError(res, 400, 'Diese Nachricht gehört nicht zu diesem Channel.');
      }
      return res.redirect(`/app/servers/${serverId}?channel=${channelId}`);
    }

    if (!content) {
      if (req.accepts('json') && req.is('application/json')) {
        return buildJsonMessageActionError(res, 400, 'Nachricht ist leer.');
      }
      return res.redirect(`/app/servers/${serverId}?channel=${channelId}`);
    }

    const updateResult = updateMessageForActor({
      messageId: editMessageId,
      actorId: req.session.userId,
      content,
      emojiEntities: payload.emojiEntities
    });

    if (!updateResult.ok) {
      const errorText = updateResult.code === 'forbidden'
        ? 'Diese Nachricht kann nicht bearbeitet werden.'
        : 'Nachricht konnte nicht bearbeitet werden.';
      if (req.accepts('json') && req.is('application/json')) {
        return buildJsonMessageActionError(res, updateResult.code === 'forbidden' ? 403 : 400, errorText);
      }
      return res.redirect(`/app/servers/${serverId}?channel=${channelId}`);
    }

    if (req.accepts('json') && req.is('application/json')) {
      return res.json({
        ok: true,
        mode: 'edit',
        message: applyPresenceToMessage(updateResult.message)
      });
    }

    return res.redirect(`/app/servers/${serverId}?channel=${channelId}`);
  }

  if (!content && !payload.attachments.length && !payload.gifIds.length) {
    if (req.accepts('json') && req.is('application/json')) {
      return res.status(400).json({ ok: false, error: 'Nachricht ist leer.' });
    }
    return res.redirect(`/app/servers/${serverId}?channel=${channelId}`);
  }

  if (tooManyMessages(req.session.userId)) {
    if (req.accepts('json') && req.is('application/json')) {
      return res.status(429).json({ ok: false, error: 'Du sendest zu schnell. Bitte kurz warten.' });
    }
    return res.redirect(`/app/servers/${serverId}?channel=${channelId}`);
  }

  const messageId = createMessageInChannel({
    channelId,
    authorId: req.session.userId,
    content,
    attachments: payload.attachments,
    emojiEntities: payload.emojiEntities,
    gifIds: payload.gifIds,
    replyToMessageId: replyTarget.replyToMessageId
  });
  const message = getHydratedMessageById(messageId);
  const serverSokratesAction = message
    ? await maybeTriggerSokratesServerInteraction({
      req,
      serverId,
      channelId,
      sourceMessage: message
    })
    : null;

  if (req.accepts('json') && req.is('application/json')) {
    return res.status(201).json({
      ok: true,
      message,
      serverSokratesAction
    });
  }

  return res.redirect(`/app/servers/${serverId}?channel=${channelId}`);
});

module.exports = { appRouter: router };
