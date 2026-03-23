const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const { db } = require('./connection');

const SOKRATES_AGENT_SLUG = 'sokrates';
const SOKRATES_EMAIL = 'sokrates@apeiron.system';
const SOKRATES_USERNAME = 'sokrates_ai_agent';
const SOKRATES_DISPLAY_NAME = 'Sokrates';
const SOKRATES_ABOUT_ME = [
  'Ich bin Sokrates.',
  'Man nennt mich einen Fragenden, keinen Lehrmeister. Ich sammle keine Antworten wie Münzen, ich prüfe sie wie Metall im Feuer.',
  'Wenn du mir eine Behauptung gibst, frage ich nach ihrem Grund. Wenn du mir ein Ziel nennst, frage ich nach seinem Preis. Und wenn du sicher bist, frage ich, was dich so sicher macht.',
  'Ich verspreche dir keine Bequemlichkeit. Aber ich biete dir Klarheit: Schritt für Schritt, bis das, was du meinst, auch wirklich das ist, was du sagst.'
].join('\n\n');
const SOKRATES_AVATAR_URL = '/public/ressources/DerDichterundDenker.jpg';
const SOKRATES_BANNER_URL = '/public/ressources/NyaUwuUsoWarm.jpg';

function parseJsonObject(value, fallback = {}) {
  if (!value || typeof value !== 'string') {
    return { ...fallback };
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...fallback };
    }
    return parsed;
  } catch (_error) {
    return { ...fallback };
  }
}

function parseJsonArray(value, fallback = []) {
  if (!value || typeof value !== 'string') {
    return [...fallback];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [...fallback];
    }
    return [...parsed];
  } catch (_error) {
    return [...fallback];
  }
}

function normalizeServerAccentColor(value) {
  const trimmed = String(value || '').trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  if (/^#[0-9a-f]{6}$/.test(trimmed)) {
    return trimmed;
  }
  return '';
}

function normalizeServerTraits(value, limit = 8) {
  const items = Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,]/g);
  const unique = new Set();
  const traits = [];

  items.forEach((entry) => {
    if (traits.length >= limit) {
      return;
    }
    const cleaned = String(entry || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^a-zA-Z0-9 +#._-]/g, '')
      .slice(0, 24);
    if (!cleaned) {
      return;
    }
    const key = cleaned.toLowerCase();
    if (unique.has(key)) {
      return;
    }
    unique.add(key);
    traits.push(cleaned);
  });

  return traits;
}

function mapServerRow(row) {
  if (!row) {
    return null;
  }
  const traits = parseJsonArray(row.traits_json, [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .slice(0, 8);
  return {
    ...row,
    icon_url: String(row.icon_url || '').trim(),
    banner_url: String(row.banner_url || '').trim(),
    accent_color: normalizeServerAccentColor(row.accent_color),
    traits_json: JSON.stringify(traits),
    traits
  };
}

function createUser({ email, username, displayName, password, dateOfBirth }) {
  const passwordHash = bcrypt.hashSync(password, 12);
  const stmt = db.prepare(`
    INSERT INTO users (email, username, display_name, password_hash, date_of_birth)
    VALUES (?, ?, ?, ?, ?)
  `);

  return stmt.run(email.toLowerCase(), username.toLowerCase(), displayName, passwordHash, dateOfBirth).lastInsertRowid;
}

function ensureSokratesAgentUser() {
  const existing = db.prepare(
    'SELECT id, username, display_name, avatar_url FROM users WHERE username = ? AND is_system_agent = 1'
  ).get(SOKRATES_USERNAME);
  if (existing) {
    db.prepare(
      `UPDATE users
       SET display_name = ?,
           about_me = ?,
           avatar_url = ?,
           banner_url = ?,
           presence_status = 'online'
       WHERE id = ?`
    ).run(
      SOKRATES_DISPLAY_NAME,
      SOKRATES_ABOUT_ME,
      SOKRATES_AVATAR_URL,
      SOKRATES_BANNER_URL,
      existing.id
    );
    return {
      ...existing,
      display_name: SOKRATES_DISPLAY_NAME,
      avatar_url: SOKRATES_AVATAR_URL,
      banner_url: SOKRATES_BANNER_URL
    };
  }

  const passwordHash = bcrypt.hashSync(nanoid(48), 12);
  const userId = db.prepare(
    `INSERT INTO users
       (email, username, display_name, password_hash, date_of_birth, about_me, avatar_url, banner_url, is_locked, is_system_agent, presence_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    SOKRATES_EMAIL,
    SOKRATES_USERNAME,
    SOKRATES_DISPLAY_NAME,
    passwordHash,
    '0469-01-01',
    SOKRATES_ABOUT_ME,
    SOKRATES_AVATAR_URL,
    SOKRATES_BANNER_URL,
    1,
    1,
    'online'
  ).lastInsertRowid;

  return {
    id: userId,
    username: SOKRATES_USERNAME,
    display_name: SOKRATES_DISPLAY_NAME,
    avatar_url: SOKRATES_AVATAR_URL,
    banner_url: SOKRATES_BANNER_URL
  };
}

function ensureSokratesThreadForUser(userId) {
  const actorId = Number(userId || 0);
  if (!actorId) {
    return null;
  }

  const agentUser = ensureSokratesAgentUser();
  const mapped = db.prepare(
    `SELECT t.id
     FROM ai_dm_threads m
     JOIN dm_threads t ON t.id = m.thread_id
     WHERE m.user_id = ?
       AND m.agent_key = ?
     LIMIT 1`
  ).get(actorId, SOKRATES_AGENT_SLUG);

  if (mapped) {
    return mapped.id;
  }

  const existing = db.prepare(
    `SELECT t.id
     FROM dm_threads t
     JOIN dm_participants self ON self.thread_id = t.id AND self.user_id = ?
     JOIN dm_participants agent ON agent.thread_id = t.id AND agent.user_id = ?
     WHERE t.thread_type = 'ai_dm'
       AND t.agent_slug = ?
     LIMIT 1`
  ).get(actorId, agentUser.id, SOKRATES_AGENT_SLUG);

  if (existing) {
    db.prepare(
      `INSERT OR IGNORE INTO ai_dm_threads (user_id, agent_key, agent_slug, thread_id)
       VALUES (?, ?, ?, ?)`
    ).run(actorId, SOKRATES_AGENT_SLUG, SOKRATES_AGENT_SLUG, existing.id);
    return existing.id;
  }

  const tx = db.transaction(() => {
    const threadId = db.prepare(
      `INSERT INTO dm_threads (title, icon_emoji, is_group, created_by, thread_type, agent_slug)
       VALUES (?, ?, 0, ?, 'ai_dm', ?)`
    ).run(SOKRATES_DISPLAY_NAME, 'Σ', agentUser.id, SOKRATES_AGENT_SLUG).lastInsertRowid;

    db.prepare('INSERT OR IGNORE INTO dm_participants (thread_id, user_id, muted, is_message_request) VALUES (?, ?, 0, 0)')
      .run(threadId, actorId);
    db.prepare('INSERT OR IGNORE INTO dm_participants (thread_id, user_id, muted, is_message_request) VALUES (?, ?, 0, 0)')
      .run(threadId, agentUser.id);
    db.prepare(
      `INSERT INTO ai_dm_threads (user_id, agent_key, agent_slug, thread_id)
       VALUES (?, ?, ?, ?)`
    ).run(actorId, SOKRATES_AGENT_SLUG, SOKRATES_AGENT_SLUG, threadId);
    return threadId;
  });

  return tx();
}

function isAiDmThread(thread) {
  return Boolean(thread && thread.thread_type === 'ai_dm' && thread.agent_slug === SOKRATES_AGENT_SLUG);
}

function findUserByLogin(identifier) {
  return db
    .prepare('SELECT * FROM users WHERE is_system_agent = 0 AND (email = ? OR username = ?)')
    .get(identifier.toLowerCase(), identifier.toLowerCase());
}

function findUserById(userId) {
  return db
    .prepare(
      `SELECT id, email, username, display_name, about_me, avatar_url, banner_url,
              presence_status, custom_status_emoji, custom_status_text, custom_status_expires_at,
              created_at, is_deactivated, is_system_agent, session_version
       FROM users
       WHERE id = ?`
    )
    .get(userId);
}

function findUserProfileById(userId) {
  return db.prepare(
    `SELECT id, username, display_name, about_me, avatar_url, banner_url, created_at, presence_status, is_deactivated, is_system_agent
     FROM users
     WHERE id = ?`
  ).get(userId);
}

function countMutualServers(userId, otherUserId) {
  const row = db.prepare(
    `SELECT COUNT(*) AS count
     FROM (
       SELECT a.server_id
       FROM server_members a
       JOIN server_members b ON b.server_id = a.server_id
       WHERE a.user_id = ? AND b.user_id = ?
     ) shared`
  ).get(userId, otherUserId);
  return row ? row.count : 0;
}

function countMutualFriends(userId, otherUserId) {
  const row = db.prepare(
    `SELECT COUNT(*) AS count
     FROM (
       SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS friend_id
       FROM friendships
       WHERE (requester_id = ? OR addressee_id = ?)
         AND status = 'accepted'
     ) mine
     JOIN (
       SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS friend_id
       FROM friendships
       WHERE (requester_id = ? OR addressee_id = ?)
         AND status = 'accepted'
     ) theirs
     ON mine.friend_id = theirs.friend_id`
  ).get(userId, userId, userId, otherUserId, otherUserId, otherUserId);
  return row ? row.count : 0;
}

function listMutualServers(userId, otherUserId, limit = 12) {
  return db.prepare(
    `SELECT s.id,
            s.name,
            s.description
     FROM servers s
     JOIN server_members mine ON mine.server_id = s.id
     JOIN server_members theirs ON theirs.server_id = s.id
     WHERE mine.user_id = ?
       AND theirs.user_id = ?
     ORDER BY LOWER(s.name) ASC
     LIMIT ?`
  ).all(userId, otherUserId, Math.max(1, Number(limit || 12)));
}

function listMutualFriends(userId, otherUserId, limit = 12) {
  return db.prepare(
    `SELECT u.id,
            u.username,
            CASE WHEN u.is_deactivated = 1 THEN 'Deleted User' ELSE u.display_name END AS display_name,
            u.avatar_url,
            u.presence_status
     FROM users u
     JOIN (
       SELECT CASE
                WHEN requester_id = ? THEN addressee_id
                ELSE requester_id
              END AS friend_id
       FROM friendships
       WHERE (requester_id = ? OR addressee_id = ?)
         AND status = 'accepted'
     ) mine
       ON mine.friend_id = u.id
     JOIN (
       SELECT CASE
                WHEN requester_id = ? THEN addressee_id
                ELSE requester_id
              END AS friend_id
       FROM friendships
       WHERE (requester_id = ? OR addressee_id = ?)
         AND status = 'accepted'
     ) theirs
       ON theirs.friend_id = u.id
     ORDER BY LOWER(u.display_name) ASC
     LIMIT ?`
  ).all(
    userId,
    userId,
    userId,
    otherUserId,
    otherUserId,
    otherUserId,
    Math.max(1, Number(limit || 12))
  );
}

function validatePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function usernameExists(username) {
  const row = db.prepare('SELECT id FROM users WHERE username = ?').get(username.toLowerCase());
  return Boolean(row);
}

function emailExists(email) {
  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  return Boolean(row);
}

function createResetToken(userId) {
  const token = nanoid(48);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
  db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(userId, token, expiresAt);
  return token;
}

function findValidResetToken(token) {
  return db
    .prepare(
      `SELECT prt.*, u.email, u.username FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = ? AND prt.used_at IS NULL AND datetime(prt.expires_at) > datetime('now')`
    )
    .get(token);
}

function useResetTokenAndUpdatePassword({ token, newPassword }) {
  const record = findValidResetToken(token);
  if (!record) {
    return false;
  }

  const passwordHash = bcrypt.hashSync(newPassword, 12);
  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, record.user_id);
    db.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = ?').run(token);
  });
  tx();
  return true;
}

function ensureUserSettings(userId) {
  db.prepare(
    `INSERT OR IGNORE INTO user_settings (user_id, dm_permission, friend_request_permission, message_requests_enabled, block_history_mode)
     VALUES (?, 'all', 'everyone', 0, 'visible')`
  ).run(userId);
}

function getUserSettings(userId) {
  ensureUserSettings(userId);
  return db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
}

function updateUserSettings(userId, { dmPermission, friendRequestPermission, messageRequestsEnabled, blockHistoryMode }) {
  ensureUserSettings(userId);
  db.prepare(
    `UPDATE user_settings
     SET dm_permission = ?,
         friend_request_permission = ?,
         message_requests_enabled = ?,
         block_history_mode = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(dmPermission, friendRequestPermission, messageRequestsEnabled ? 1 : 0, blockHistoryMode, userId);
}

function getGlobalSettingsState(userId) {
  ensureUserSettings(userId);
  const user = db.prepare(
    `SELECT id, email, username, display_name, about_me, avatar_url, banner_url,
            presence_status, custom_status_emoji, custom_status_text, custom_status_expires_at,
            pending_email, session_version, is_deactivated
     FROM users
     WHERE id = ?`
  ).get(userId);
  const settings = getUserSettings(userId);
  return { user, settings };
}

function requestEmailChangeVerification(userId, newEmail) {
  const token = nanoid(40);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET pending_email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newEmail.toLowerCase(), userId);
    db.prepare('INSERT INTO email_verify_tokens (user_id, new_email, token, expires_at) VALUES (?, ?, ?, ?)').run(userId, newEmail.toLowerCase(), token, expiresAt);
  });
  tx();
  return token;
}

function applyEmailVerificationToken(token) {
  const record = db.prepare(
    `SELECT *
     FROM email_verify_tokens
     WHERE token = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')`
  ).get(token);
  if (!record) {
    return false;
  }

  const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(record.new_email, record.user_id);
  if (conflict) {
    return false;
  }

  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET email = ?, pending_email = \'\', updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(record.new_email, record.user_id);
    db.prepare('UPDATE email_verify_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(record.id);
  });
  tx();
  return true;
}

function updateAccountIdentity(userId, { username, email }) {
  const normalizedUsername = String(username || '').trim().replace(/^@/, '').toLowerCase();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const current = db.prepare('SELECT username, email FROM users WHERE id = ?').get(userId);

  if (!current) {
    return { ok: false, code: 'not_found' };
  }

  if (!normalizedUsername || !normalizedEmail) {
    return { ok: false, code: 'invalid' };
  }

  const usernameOwner = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(normalizedUsername, userId);
  if (usernameOwner) {
    return { ok: false, code: 'username_taken' };
  }

  db.prepare('UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(normalizedUsername, userId);

  const emailChanged = current.email !== normalizedEmail;
  if (emailChanged) {
    const token = requestEmailChangeVerification(userId, normalizedEmail);
    return { ok: true, emailVerificationToken: token, emailChanged: true };
  }

  return { ok: true, emailChanged: false };
}

function changeUserPassword(userId, { currentPassword, newPassword }) {
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return { ok: false, code: 'invalid_current' };
  }

  if (String(newPassword || '').length < 8 || !/\d/.test(newPassword)) {
    return { ok: false, code: 'weak_password' };
  }

  const passwordHash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, userId);
  return { ok: true };
}

function incrementSessionVersion(userId) {
  db.prepare('UPDATE users SET session_version = session_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
  const row = db.prepare('SELECT session_version FROM users WHERE id = ?').get(userId);
  return row ? row.session_version : 1;
}

function deactivateUserAccount(userId) {
  db.prepare('UPDATE users SET is_deactivated = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
}

function deleteUserAccount(userId) {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

function updateUserProfileSettings(userId, {
  displayName,
  aboutMe,
  avatarUrl,
  bannerUrl,
  presenceStatus,
  customStatusEmoji,
  customStatusText,
  customStatusExpiresAt
}) {
  const safePresence = ['online', 'idle', 'dnd', 'streaming', 'invisible'].includes(presenceStatus) ? presenceStatus : 'online';
  db.prepare(
    `UPDATE users
     SET display_name = ?,
         about_me = ?,
         avatar_url = ?,
         banner_url = ?,
         presence_status = ?,
         custom_status_emoji = ?,
         custom_status_text = ?,
         custom_status_expires_at = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    String(displayName || '').trim(),
    String(aboutMe || '').trim(),
    String(avatarUrl || '').trim(),
    String(bannerUrl || '').trim(),
    safePresence,
    String(customStatusEmoji || '').trim().slice(0, 4),
    String(customStatusText || '').trim().slice(0, 120),
    customStatusExpiresAt || null,
    userId
  );
}

function getUserProfileExtras(userId) {
  const row = db.prepare(
    `SELECT about_plus_json
     FROM user_profile_extras
     WHERE user_id = ?`
  ).get(userId);

  return parseJsonObject(row?.about_plus_json, {});
}

function upsertUserProfileExtras(userId, aboutPlus = {}) {
  db.prepare(
    `INSERT INTO user_profile_extras (user_id, about_plus_json, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       about_plus_json = excluded.about_plus_json,
       updated_at = CURRENT_TIMESTAMP`
  ).run(userId, JSON.stringify(aboutPlus || {}));
}

function findGameCoverCacheByName(normalizedName) {
  return db.prepare(
    `SELECT normalized_name,
            provider,
            matched_name,
            image_id,
            source_url,
            local_file_url,
            attribution,
            status,
            expires_at,
            updated_at
     FROM game_cover_cache
     WHERE normalized_name = ?`
  ).get(String(normalizedName || '').trim());
}

function upsertGameCoverCache(entry = {}) {
  db.prepare(
    `INSERT INTO game_cover_cache (
       normalized_name,
       provider,
       matched_name,
       image_id,
       source_url,
       local_file_url,
       attribution,
       status,
       expires_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(normalized_name) DO UPDATE SET
       provider = excluded.provider,
       matched_name = excluded.matched_name,
       image_id = excluded.image_id,
       source_url = excluded.source_url,
       local_file_url = excluded.local_file_url,
       attribution = excluded.attribution,
       status = excluded.status,
       expires_at = excluded.expires_at,
       updated_at = CURRENT_TIMESTAMP`
  ).run(
    String(entry.normalized_name || '').trim(),
    String(entry.provider || 'igdb').trim() || 'igdb',
    String(entry.matched_name || '').trim(),
    String(entry.image_id || '').trim(),
    String(entry.source_url || '').trim(),
    String(entry.local_file_url || '').trim(),
    String(entry.attribution || '').trim(),
    String(entry.status || 'not_found').trim() || 'not_found',
    String(entry.expires_at || new Date().toISOString()).trim()
  );
}

function listUserProfileMedia(userId, viewerId, limit = 24) {
  const isOwner = Number(userId || 0) === Number(viewerId || 0);
  return db.prepare(
    `SELECT id,
            user_id,
            title,
            file_url,
            mime_type,
            visibility,
            effect_name,
            created_at
     FROM user_profile_media
     WHERE user_id = ?
       AND (? = 1 OR visibility = 'public')
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT ?`
  ).all(
    userId,
    isOwner ? 1 : 0,
    Math.max(1, Number(limit || 24))
  );
}

function countUserProfileMedia(userId) {
  const row = db.prepare(
    `SELECT COUNT(*) AS count
     FROM user_profile_media
     WHERE user_id = ?`
  ).get(userId);

  return Number(row?.count || 0);
}

function createUserProfileMedia({
  userId,
  title,
  fileUrl,
  mimeType,
  visibility,
  effectName
}) {
  const safeVisibility = visibility === 'private' ? 'private' : 'public';
  const safeEffect = ['none', 'frame', 'glow', 'sticker'].includes(String(effectName || '').trim())
    ? String(effectName || '').trim()
    : 'none';

  return db.prepare(
    `INSERT INTO user_profile_media (user_id, title, file_url, mime_type, visibility, effect_name)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    String(title || '').trim().slice(0, 120),
    String(fileUrl || '').trim(),
    String(mimeType || '').trim().slice(0, 80),
    safeVisibility,
    safeEffect
  ).lastInsertRowid;
}

function updateNotificationSettings(userId, { desktopPush, soundsEnabled, mentionsMode }) {
  ensureUserSettings(userId);
  const safeMentions = ['me', 'roles', 'all'].includes(mentionsMode) ? mentionsMode : 'me';
  db.prepare(
    `UPDATE user_settings
     SET notifications_desktop = ?,
         notifications_sounds = ?,
         notifications_mentions = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(desktopPush ? 1 : 0, soundsEnabled ? 1 : 0, safeMentions, userId);
}

function updateAppearanceSettings(userId, { theme, fontScale, density, avatarGrouping, reducedMotion }) {
  ensureUserSettings(userId);
  const safeTheme = ['dark', 'light'].includes(theme) ? theme : 'dark';
  const safeDensity = ['compact', 'cozy'].includes(density) ? density : 'cozy';
  const safeGrouping = ['always', 'grouped'].includes(avatarGrouping) ? avatarGrouping : 'always';
  const safeFontScale = Math.max(80, Math.min(140, Number(fontScale) || 100));

  db.prepare(
    `UPDATE user_settings
     SET appearance_theme = ?,
         appearance_font_scale = ?,
         appearance_density = ?,
         appearance_avatar_grouping = ?,
         appearance_reduced_motion = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(safeTheme, safeFontScale, safeDensity, safeGrouping, reducedMotion ? 1 : 0, userId);
}

function updateAccessibilitySettings(userId, { screenReaderHints, highContrast }) {
  ensureUserSettings(userId);
  db.prepare(
    `UPDATE user_settings
     SET accessibility_screen_reader_hints = ?,
         accessibility_high_contrast = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(screenReaderHints ? 1 : 0, highContrast ? 1 : 0, userId);
}

function updateVoiceVideoSettings(userId, {
  inputDevice,
  outputDevice,
  inputSensitivity,
  echoCancellation,
  noiseSuppression,
  cameraDevice,
  pttKey
}) {
  ensureUserSettings(userId);
  const safeSensitivity = Math.max(0, Math.min(100, Number(inputSensitivity) || 50));
  db.prepare(
    `UPDATE user_settings
     SET voice_input_device = ?,
         voice_output_device = ?,
         voice_input_sensitivity = ?,
         voice_echo_cancellation = ?,
         voice_noise_suppression = ?,
         voice_camera_device = ?,
         voice_ptt_key = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(
    String(inputDevice || 'Default Microphone'),
    String(outputDevice || 'Default Speakers'),
    safeSensitivity,
    echoCancellation ? 1 : 0,
    noiseSuppression ? 1 : 0,
    String(cameraDevice || 'Default Camera'),
    String(pttKey || 'V').trim().slice(0, 20),
    userId
  );
}

function updateLanguageSettings(userId, language) {
  ensureUserSettings(userId);
  const safeLanguage = ['de', 'en', 'fr', 'es', 'it'].includes(language) ? language : 'de';
  db.prepare(
    `UPDATE user_settings
     SET app_language = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(safeLanguage, userId);
}

function updateAiProviderSettings(userId, {
  providerMode,
  openaiModel,
  ollamaModel
}) {
  ensureUserSettings(userId);
  const safeProviderMode = ['openai', 'ollama', 'auto'].includes(providerMode) ? providerMode : 'auto';
  const safeOpenAiModel = String(openaiModel || '').trim().slice(0, 120);
  const safeOllamaModel = String(ollamaModel || '').trim().slice(0, 120);

  db.prepare(
    `UPDATE user_settings
     SET llm_provider_mode = ?,
         llm_openai_model = ?,
         llm_ollama_model = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(safeProviderMode, safeOpenAiModel, safeOllamaModel, userId);
}

function updateConnections(userId, connections) {
  ensureUserSettings(userId);
  const payload = JSON.stringify(Array.isArray(connections) ? connections.slice(0, 20) : []);
  db.prepare(
    `UPDATE user_settings
     SET connections_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(payload, userId);
}

function areUsersFriends(userId, otherUserId) {
  const row = db
    .prepare(
      `SELECT id
       FROM friendships
       WHERE status = 'accepted'
         AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`
    )
    .get(userId, otherUserId, otherUserId, userId);
  return Boolean(row);
}

function haveSharedServer(userId, otherUserId) {
  const row = db
    .prepare(
      `SELECT 1
       FROM server_members a
       JOIN server_members b ON b.server_id = a.server_id
       WHERE a.user_id = ? AND b.user_id = ?
       LIMIT 1`
    )
    .get(userId, otherUserId);
  return Boolean(row);
}

function isBlockedBetween(userId, otherUserId) {
  const row = db
    .prepare(
      `SELECT id
       FROM friendships
       WHERE status = 'blocked'
         AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
       LIMIT 1`
    )
    .get(userId, otherUserId, otherUserId, userId);
  return Boolean(row);
}

function listDMThreadsForUser(userId) {
  return db
    .prepare(
      `SELECT t.id,
              t.title,
              t.icon_emoji,
              t.is_group,
              t.thread_type,
              t.agent_slug,
              t.created_by,
              p.muted,
              p.is_message_request,
              MAX(m.created_at) AS last_message_at,
              COALESCE(SUM(CASE
                WHEN m.id > COALESCE(p.last_read_message_id, 0)
                 AND m.author_id != ? THEN 1 ELSE 0 END), 0) AS unread_count,
              COALESCE(SUM(CASE
                WHEN p.muted = 0
                 AND m.id > COALESCE(p.last_read_message_id, 0)
                 AND m.author_id != ?
                 AND LOWER(m.content) LIKE '%@' || LOWER(self_user.username) || '%'
                THEN 1 ELSE 0 END), 0) AS mention_count
       FROM dm_threads t
       JOIN dm_participants p ON p.thread_id = t.id
       JOIN users self_user ON self_user.id = p.user_id
       LEFT JOIN messages m ON m.thread_id = t.id
       WHERE p.user_id = ?
       GROUP BY t.id, t.title, t.icon_emoji, t.is_group, t.thread_type, t.agent_slug, t.created_by, p.muted, p.is_message_request
       ORDER BY
         CASE WHEN t.thread_type = 'ai_dm' THEN 0 ELSE 1 END,
         CASE WHEN p.muted = 0 AND COALESCE(SUM(CASE
           WHEN m.id > COALESCE(p.last_read_message_id, 0)
            AND m.author_id != ?
            AND LOWER(m.content) LIKE '%@' || LOWER(self_user.username) || '%'
           THEN 1 ELSE 0 END), 0) > 0 THEN 0 ELSE 1 END,
         CASE WHEN p.muted = 0 AND COALESCE(SUM(CASE WHEN m.id > COALESCE(p.last_read_message_id, 0) AND m.author_id != ? THEN 1 ELSE 0 END), 0) > 0 THEN 0 ELSE 1 END,
         last_message_at DESC NULLS LAST,
         t.id DESC`
    )
    .all(userId, userId, userId, userId, userId);
}

function listParticipantsForThread(threadId) {
  return db
    .prepare(
      `SELECT u.id,
              u.username,
              CASE WHEN u.is_deactivated = 1 THEN 'Deleted User' ELSE u.display_name END AS display_name,
              u.avatar_url,
              u.presence_status,
              u.custom_status_emoji,
              u.custom_status_text,
              u.custom_status_expires_at,
              u.is_system_agent,
              u.is_deactivated
       FROM dm_participants p
       JOIN users u ON u.id = p.user_id
       WHERE p.thread_id = ?
       ORDER BY u.display_name`
    )
    .all(threadId);
}

function listMessagesForThread(threadId, limit = 100) {
  const messages = db
    .prepare(
      `SELECT *
       FROM (
         SELECT m.id,
                m.content,
                m.kind,
                m.agent_slug,
                m.reply_to_message_id,
                m.created_at,
                m.edited_at,
                u.id AS author_id,
                u.username AS author_username,
                u.avatar_url AS author_avatar_url,
                u.presence_status AS author_presence_status,
                CASE WHEN u.is_deactivated = 1 THEN 'Deleted User' ELSE u.display_name END AS author_display_name,
                u.is_system_agent AS author_is_system_agent,
                u.is_deactivated AS author_is_deactivated
         FROM messages m
         JOIN users u ON u.id = m.author_id
         WHERE m.thread_id = ?
         ORDER BY m.id DESC
         LIMIT ?
       ) recent
       ORDER BY recent.id ASC`
    )
    .all(threadId, limit);

  if (!messages.length) {
    return messages;
  }

  return hydrateReplyReferences(hydrateAttachments(messages));
}

function listMessagesForThreadThroughMessage(threadId, maxMessageId, limit = 100) {
  const cap = Number(maxMessageId || 0);
  if (!cap) {
    return [];
  }

  const messages = db
    .prepare(
      `SELECT *
       FROM (
         SELECT m.id,
                m.content,
                m.kind,
                m.agent_slug,
                m.reply_to_message_id,
                m.created_at,
                m.edited_at,
                u.id AS author_id,
                u.username AS author_username,
                u.avatar_url AS author_avatar_url,
                CASE WHEN u.is_deactivated = 1 THEN 'Deleted User' ELSE u.display_name END AS author_display_name,
                u.is_system_agent AS author_is_system_agent,
                u.is_deactivated AS author_is_deactivated
         FROM messages m
         JOIN users u ON u.id = m.author_id
         WHERE m.thread_id = ?
           AND m.id <= ?
         ORDER BY m.id DESC
         LIMIT ?
       ) recent
       ORDER BY recent.id ASC`
    )
    .all(threadId, cap, limit);

  if (!messages.length) {
    return messages;
  }

  return hydrateReplyReferences(hydrateAttachments(messages));
}

function hydrateAttachments(messages) {
  if (!messages.length) {
    return messages;
  }

  let rows = [];
  try {
    const placeholders = messages.map(() => '?').join(',');
    rows = db.prepare(
      `SELECT id, message_id, kind, mime_type, filename, file_size, url
       FROM message_attachments
       WHERE message_id IN (${placeholders})
       ORDER BY id ASC`
    ).all(...messages.map((m) => m.id));
  } catch (error) {
    return messages.map((message) => ({ ...message, attachments: [] }));
  }

  const byMessage = new Map();
  rows.forEach((row) => {
    const list = byMessage.get(row.message_id) || [];
    list.push(row);
    byMessage.set(row.message_id, list);
  });

  const withAttachments = messages.map((message) => ({
    ...message,
    attachments: byMessage.get(message.id) || []
  }));

  let emojiRows = [];
  try {
    const placeholders = withAttachments.map(() => '?').join(',');
    emojiRows = db.prepare(
      `SELECT e.id,
              e.message_id,
              e.emoji_id,
              e.token,
              ue.name,
              ue.url,
              ue.mime_type
       FROM message_emoji_entities e
       JOIN user_emojis ue ON ue.id = e.emoji_id
       WHERE e.message_id IN (${placeholders})
       ORDER BY e.id ASC`
    ).all(...withAttachments.map((m) => m.id));
  } catch (error) {
    emojiRows = [];
  }

  const emojiByMessage = new Map();
  emojiRows.forEach((row) => {
    const list = emojiByMessage.get(row.message_id) || [];
    list.push({
      id: row.emoji_id,
      token: row.token,
      name: row.name,
      url: row.url,
      mime_type: row.mime_type
    });
    emojiByMessage.set(row.message_id, list);
  });

  const withEmojis = withAttachments.map((message) => ({
    ...message,
    emoji_entities: emojiByMessage.get(message.id) || []
  }));

  let gifRows = [];
  try {
    const placeholders = withEmojis.map(() => '?').join(',');
    gifRows = db.prepare(
      `SELECT g.message_id,
              COALESCE(ga.id, g.gif_id) AS gif_id,
              COALESCE(ga.name, 'deleted_gif') AS name,
              COALESCE(ga.tags, '') AS tags,
              COALESCE(ga.url, '') AS url,
              COALESCE(ga.mime_type, 'image/gif') AS mime_type,
              ga.width,
              ga.height,
              CASE
                WHEN ga.id IS NULL OR ga.is_deleted = 1 THEN 1
                ELSE 0
              END AS is_deleted
       FROM message_gif_entities g
       LEFT JOIN gif_assets ga ON ga.id = g.gif_id
       WHERE g.message_id IN (${placeholders})
       ORDER BY g.id ASC`
    ).all(...withEmojis.map((m) => m.id));
  } catch (error) {
    gifRows = [];
  }

  const gifsByMessage = new Map();
  gifRows.forEach((row) => {
    const list = gifsByMessage.get(row.message_id) || [];
    list.push({
      id: row.gif_id,
      name: row.name,
      tags: row.tags,
      url: Number(row.is_deleted || 0) === 1 ? '' : row.url,
      mime_type: row.mime_type,
      width: row.width,
      height: row.height,
      deleted: Number(row.is_deleted || 0) === 1
    });
    gifsByMessage.set(row.message_id, list);
  });

  const withGifs = withEmojis.map((message) => ({
    ...message,
    gifs: gifsByMessage.get(message.id) || []
  }));

  let reactionRows = [];
  try {
    const placeholders = withGifs.map(() => '?').join(',');
    reactionRows = db.prepare(
      `SELECT message_id,
              emoji,
              COUNT(*) AS reaction_count
       FROM message_reactions
       WHERE message_id IN (${placeholders})
       GROUP BY message_id, emoji
       ORDER BY MIN(id) ASC`
    ).all(...withGifs.map((message) => message.id));
  } catch (error) {
    reactionRows = [];
  }

  const reactionsByMessage = new Map();
  reactionRows.forEach((row) => {
    const list = reactionsByMessage.get(row.message_id) || [];
    list.push({
      emoji: String(row.emoji || ''),
      count: Number(row.reaction_count || 0)
    });
    reactionsByMessage.set(row.message_id, list);
  });

  return withGifs.map((message) => ({
    ...message,
    reactions: reactionsByMessage.get(message.id) || []
  }));
}

function hydrateReplyReferences(messages) {
  if (!Array.isArray(messages) || !messages.length) {
    return messages;
  }

  const replyIds = [...new Set(
    messages
      .map((message) => Number(message.reply_to_message_id || 0))
      .filter((messageId) => messageId > 0)
  )];

  if (!replyIds.length) {
    return messages;
  }

  const placeholders = replyIds.map(() => '?').join(',');
  const replyRows = db.prepare(
    `SELECT m.id,
            m.content,
            m.author_id,
            u.username AS author_username,
            CASE WHEN u.is_deactivated = 1 THEN 'Deleted User' ELSE u.display_name END AS author_display_name
     FROM messages m
     JOIN users u ON u.id = m.author_id
     WHERE m.id IN (${placeholders})`
  ).all(...replyIds);

  const repliesById = new Map(replyRows.map((row) => [Number(row.id), row]));

  return messages.map((message) => {
    const replyToMessageId = Number(message.reply_to_message_id || 0);
    if (!replyToMessageId) {
      return {
        ...message,
        reply_to_message: null
      };
    }

    const target = repliesById.get(replyToMessageId);
    if (!target) {
      return {
        ...message,
        reply_to_message: {
          id: replyToMessageId,
          missing: true,
          content: '',
          author_id: 0,
          author_username: '',
          author_display_name: 'Deleted message'
        }
      };
    }

    return {
      ...message,
      reply_to_message: {
        id: replyToMessageId,
        missing: false,
        content: target.content || '',
        author_id: Number(target.author_id || 0),
        author_username: target.author_username || '',
        author_display_name: target.author_display_name || target.author_username || 'User'
      }
    };
  });
}

function getMessageById(messageId) {
  const row = db.prepare(
    `SELECT m.id,
            m.thread_id,
            m.channel_id,
            m.content,
            m.kind,
            m.agent_slug,
            m.reply_to_message_id,
            m.created_at,
            m.edited_at,
            u.id AS author_id,
            u.username AS author_username,
            u.avatar_url AS author_avatar_url,
            u.presence_status AS author_presence_status,
            CASE WHEN u.is_deactivated = 1 THEN 'Deleted User' ELSE u.display_name END AS author_display_name,
            u.is_system_agent AS author_is_system_agent,
            u.is_deactivated AS author_is_deactivated
     FROM messages m
     JOIN users u ON u.id = m.author_id
     WHERE m.id = ?`
  ).get(messageId);

  if (!row) {
    return null;
  }

  return hydrateReplyReferences(hydrateAttachments([row]))[0];
}

function findAgentReplyAfterMessage(threadId, messageId, agentSlug) {
  const row = db.prepare(
    `SELECT id
     FROM messages
     WHERE thread_id = ?
       AND id > ?
       AND agent_slug = ?
     ORDER BY id ASC
     LIMIT 1`
  ).get(threadId, messageId, String(agentSlug || '').trim().toLowerCase());

  if (!row) {
    return null;
  }

  return getMessageById(row.id);
}

function listUserEmojis(userId) {
  try {
    return db.prepare(
      `SELECT id, user_id, name, mime_type, url, visibility, created_at
       FROM user_emojis
       WHERE user_id = ?
       ORDER BY name ASC, id ASC`
    ).all(userId);
  } catch (error) {
    return [];
  }
}

function listAvailableCustomEmojis(userId) {
  try {
    return db.prepare(
      `SELECT id, user_id, name, mime_type, url, visibility, created_at
       FROM user_emojis
       WHERE user_id = ?
          OR visibility = 'public'
       ORDER BY CASE WHEN user_id = ? THEN 0 ELSE 1 END ASC, name ASC, id ASC`
    ).all(userId, userId);
  } catch (error) {
    return [];
  }
}

function findUserEmojiByName(name) {
  const normalizedName = String(name || '').trim().toLowerCase();
  if (!normalizedName) {
    return null;
  }

  return db.prepare(
    `SELECT id, user_id, name, mime_type, url, visibility, created_at
     FROM user_emojis
     WHERE name = ?
     ORDER BY id ASC
     LIMIT 1`
  ).get(normalizedName) || null;
}

function createUserEmoji({ userId, name, mimeType, url, visibility = 'private' }) {
  const normalizedName = String(name || '').trim().toLowerCase();
  const normalizedVisibility = visibility === 'public' ? 'public' : 'private';
  if (!normalizedName) {
    return null;
  }

  try {
    const emojiId = db.prepare(
      'INSERT INTO user_emojis (user_id, name, mime_type, url, visibility) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, normalizedName, mimeType || 'image/png', url, normalizedVisibility).lastInsertRowid;

    return db.prepare(
      'SELECT id, user_id, name, mime_type, url, visibility, created_at FROM user_emojis WHERE id = ?'
    ).get(emojiId);
  } catch (error) {
    return db.prepare(
      'SELECT id, user_id, name, mime_type, url, visibility, created_at FROM user_emojis WHERE user_id = ? AND name = ?'
    ).get(userId, normalizedName) || null;
  }
}

function listUserEmojisByIds(userId, ids = []) {
  const numericIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!numericIds.length) {
    return [];
  }

  const placeholders = numericIds.map(() => '?').join(',');
  try {
    return db.prepare(
      `SELECT id, user_id, name, mime_type, url, visibility
       FROM user_emojis
       WHERE user_id = ?
         AND id IN (${placeholders})`
    ).all(userId, ...numericIds);
  } catch (error) {
    return [];
  }
}

function listAvailableCustomEmojisByIds(userId, ids = []) {
  const numericIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!numericIds.length) {
    return [];
  }

  const placeholders = numericIds.map(() => '?').join(',');
  try {
    return db.prepare(
      `SELECT id, user_id, name, mime_type, url, visibility
       FROM user_emojis
       WHERE (user_id = ? OR visibility = 'public')
         AND id IN (${placeholders})`
    ).all(userId, ...numericIds);
  } catch (error) {
    return [];
  }
}

function sanitizeEmojiPreferenceKeys(values, limit = 40) {
  if (!Array.isArray(values)) {
    return [];
  }

  const result = [];
  const seen = new Set();
  values.forEach((entry) => {
    const key = String(entry || '').trim().slice(0, 64);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(key);
  });
  return result.slice(0, limit);
}

function parseEmojiPreferenceList(raw, limit = 40) {
  if (!raw) {
    return [];
  }

  try {
    return sanitizeEmojiPreferenceKeys(JSON.parse(String(raw || '[]')), limit);
  } catch (error) {
    return [];
  }
}

function sanitizeGifPreferenceIds(values, limit = 40) {
  if (!Array.isArray(values)) {
    return [];
  }

  const result = [];
  const seen = new Set();
  values.forEach((entry) => {
    const id = Number(entry);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) {
      return;
    }
    seen.add(id);
    result.push(id);
  });
  return result.slice(0, limit);
}

function parseGifPreferenceList(raw, limit = 40) {
  if (!raw) {
    return [];
  }

  try {
    return sanitizeGifPreferenceIds(JSON.parse(String(raw || '[]')), limit);
  } catch (error) {
    return [];
  }
}

function getEmojiPickerState(userId) {
  const settings = getUserSettings(userId) || {};
  return {
    favorites: parseEmojiPreferenceList(settings.emoji_favorites_json, 48),
    recents: parseEmojiPreferenceList(settings.emoji_recents_json, 24)
  };
}

function setEmojiFavorites(userId, favorites = []) {
  ensureUserSettings(userId);
  const payload = JSON.stringify(sanitizeEmojiPreferenceKeys(favorites, 48));
  db.prepare(
    `UPDATE user_settings
     SET emoji_favorites_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(payload, userId);
  return getEmojiPickerState(userId);
}

function pushRecentEmoji(userId, key) {
  const safeKey = String(key || '').trim().slice(0, 64);
  if (!safeKey) {
    return getEmojiPickerState(userId);
  }

  const state = getEmojiPickerState(userId);
  const next = [safeKey, ...state.recents.filter((entry) => entry !== safeKey)].slice(0, 24);
  db.prepare(
    `UPDATE user_settings
     SET emoji_recents_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(JSON.stringify(next), userId);
  return {
    favorites: state.favorites,
    recents: next
  };
}

function getGifPickerState(userId) {
  const settings = getUserSettings(userId) || {};
  return {
    favorites: parseGifPreferenceList(settings.gif_favorites_json, 48),
    recents: parseGifPreferenceList(settings.gif_recents_json, 24)
  };
}

function setGifFavorites(userId, favorites = []) {
  ensureUserSettings(userId);
  const payload = JSON.stringify(sanitizeGifPreferenceIds(favorites, 48));
  db.prepare(
    `UPDATE user_settings
     SET gif_favorites_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(payload, userId);
  return getGifPickerState(userId);
}

function pushRecentGif(userId, gifId) {
  const safeId = Number(gifId);
  if (!Number.isInteger(safeId) || safeId <= 0) {
    return getGifPickerState(userId);
  }

  const state = getGifPickerState(userId);
  const next = [safeId, ...state.recents.filter((entry) => entry !== safeId)].slice(0, 24);
  db.prepare(
    `UPDATE user_settings
     SET gif_recents_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`
  ).run(JSON.stringify(next), userId);
  return {
    favorites: state.favorites,
    recents: next
  };
}

function deleteUserEmojiForActor({ emojiId, actorId, serverId = 0 }) {
  const row = db.prepare(
    `SELECT id, user_id, name, mime_type, url, visibility, created_at
     FROM user_emojis
     WHERE id = ?`
  ).get(emojiId);

  if (!row) {
    return { ok: false, code: 'not_found' };
  }

  const isOwner = Number(row.user_id || 0) === Number(actorId || 0);
  const canManagePublicEmoji = !isOwner
    && String(row.visibility || 'private') === 'public'
    && Number(serverId || 0) > 0
    && canManageServer(Number(serverId || 0), actorId);

  if (!isOwner && !canManagePublicEmoji) {
    return { ok: false, code: 'forbidden' };
  }

  const token = `:${String(row.name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32)}:`;
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_emojis WHERE id = ?').run(emojiId);
    const state = getEmojiPickerState(actorId);
    const nextFavorites = state.favorites.filter((entry) => entry !== token);
    const nextRecents = state.recents.filter((entry) => entry !== token);
    db.prepare(
      `UPDATE user_settings
       SET emoji_favorites_json = ?,
           emoji_recents_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`
    ).run(JSON.stringify(nextFavorites), JSON.stringify(nextRecents), actorId);
  });
  tx();

  return {
    ok: true,
    emoji: {
      id: Number(row.id),
      user_id: Number(row.user_id),
      name: String(row.name || ''),
      mime_type: String(row.mime_type || 'image/png'),
      url: String(row.url || ''),
      visibility: String(row.visibility || 'private'),
      created_at: row.created_at,
      token
    }
  };
}

function createGlobalGifAsset({ ownerId, name, tags, description, mimeType, fileSize, url }) {
  const normalizedName = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32);
  const normalizedTags = [...new Set(String(tags || '')
    .split(',')
    .map((tag) => tag.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''))
    .filter(Boolean)
    .slice(0, 10))].join(',');

  if (!normalizedName || !url) {
    return null;
  }

  try {
    const gifId = db.prepare(
      `INSERT INTO gif_assets (owner_id, name, tags, description, mime_type, file_size, url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(ownerId, normalizedName, normalizedTags, String(description || '').slice(0, 200), mimeType || 'image/gif', Number(fileSize || 0), url)
      .lastInsertRowid;

    return db.prepare(
      `SELECT g.id, g.name, g.tags, g.description, g.mime_type, g.file_size, g.url, g.owner_id, g.usage_count, g.created_at,
              CASE WHEN u.is_deactivated = 1 THEN 'Deleted User' ELSE u.display_name END AS owner_display_name,
              u.username AS owner_username
       FROM gif_assets g
       JOIN users u ON u.id = g.owner_id
       WHERE g.id = ?`
    ).get(gifId);
  } catch (error) {
    return null;
  }
}

function listGlobalGifAssets({ query = '', ownerId = null, limit = 60 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const hasQuery = q.length > 0;
  const like = `%${q}%`;
  const scopedOwnerId = ownerId ? Number(ownerId) : 0;
  const cap = Math.min(Math.max(Number(limit || 60), 1), 100);

  try {
    return db.prepare(
      `SELECT g.id, g.name, g.tags, g.description, g.mime_type, g.file_size, g.url, g.owner_id, g.usage_count, g.created_at,
              CASE WHEN u.is_deactivated = 1 THEN 'Deleted User' ELSE u.display_name END AS owner_display_name,
              u.username AS owner_username
       FROM gif_assets g
       JOIN users u ON u.id = g.owner_id
       WHERE g.is_deleted = 0
         AND (? = 0 OR g.owner_id = ?)
         AND (? = 0 OR LOWER(g.name) LIKE ? OR LOWER(g.tags) LIKE ? OR LOWER(g.description) LIKE ?)
       ORDER BY g.usage_count DESC, g.created_at DESC
       LIMIT ?`
    ).all(scopedOwnerId, scopedOwnerId, hasQuery ? 1 : 0, like, like, like, cap);
  } catch (error) {
    return [];
  }
}

function listGlobalGifsByIds(ids = []) {
  const numericIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!numericIds.length) {
    return [];
  }
  const placeholders = numericIds.map(() => '?').join(',');
  try {
    return db.prepare(
      `SELECT id, name, tags, mime_type, file_size, url, owner_id
       FROM gif_assets
       WHERE is_deleted = 0
         AND id IN (${placeholders})`
    ).all(...numericIds);
  } catch (error) {
    return [];
  }
}

function deleteGifAssetForActor({ gifId, actorId, serverId = 0 }) {
  const row = db.prepare(
    `SELECT g.id, g.name, g.tags, g.description, g.mime_type, g.file_size, g.url, g.owner_id, g.usage_count, g.created_at,
            CASE WHEN u.is_deactivated = 1 THEN 'Deleted User' ELSE u.display_name END AS owner_display_name,
            u.username AS owner_username
     FROM gif_assets g
     JOIN users u ON u.id = g.owner_id
     WHERE g.id = ?
       AND g.is_deleted = 0`
  ).get(gifId);

  if (!row) {
    return { ok: false, code: 'not_found' };
  }

  const isOwner = Number(row.owner_id || 0) === Number(actorId || 0);
  const canModerate = Number(serverId || 0) > 0 && canManageServer(Number(serverId || 0), actorId);
  if (!isOwner && !canModerate) {
    return { ok: false, code: 'forbidden' };
  }

  const normalizedGifId = Number(row.id || 0);
  const tx = db.transaction(() => {
    db.prepare('UPDATE gif_assets SET is_deleted = 1 WHERE id = ?').run(normalizedGifId);

    const settingsRows = db.prepare(
      `SELECT user_id, gif_favorites_json, gif_recents_json
       FROM user_settings`
    ).all();
    const updateSettings = db.prepare(
      `UPDATE user_settings
       SET gif_favorites_json = ?,
           gif_recents_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`
    );

    settingsRows.forEach((settings) => {
      const nextFavorites = parseGifPreferenceList(settings.gif_favorites_json, 48)
        .filter((entry) => entry !== normalizedGifId);
      const nextRecents = parseGifPreferenceList(settings.gif_recents_json, 24)
        .filter((entry) => entry !== normalizedGifId);
      updateSettings.run(JSON.stringify(nextFavorites), JSON.stringify(nextRecents), Number(settings.user_id || 0));
    });
  });
  tx();

  return {
    ok: true,
    gif: {
      ...row,
      deleted: true,
      url: ''
    }
  };
}

function getLatestMessageIdForThread(threadId) {
  const row = db
    .prepare('SELECT id FROM messages WHERE thread_id = ? ORDER BY id DESC LIMIT 1')
    .get(threadId);
  return row ? row.id : null;
}

function markThreadRead(threadId, userId, messageId) {
  if (!messageId) {
    return;
  }

  db.prepare(
    `UPDATE dm_participants
     SET last_read_message_id = CASE
       WHEN COALESCE(last_read_message_id, 0) > ? THEN last_read_message_id
       ELSE ?
     END
     WHERE thread_id = ? AND user_id = ?`
  ).run(messageId, messageId, threadId, userId);
}

function setThreadMute(threadId, userId, muted) {
  db.prepare('UPDATE dm_participants SET muted = ? WHERE thread_id = ? AND user_id = ?').run(muted ? 1 : 0, threadId, userId);
}

function setThreadMessageRequest(threadId, userId, isMessageRequest) {
  db.prepare('UPDATE dm_participants SET is_message_request = ? WHERE thread_id = ? AND user_id = ?').run(isMessageRequest ? 1 : 0, threadId, userId);
}

function userInThread(threadId, userId) {
  const row = db.prepare('SELECT 1 FROM dm_participants WHERE thread_id = ? AND user_id = ?').get(threadId, userId);
  return Boolean(row);
}

function findThreadByIdForUser(threadId, userId) {
  return db.prepare(
    `SELECT t.id,
            t.title,
            t.icon_emoji,
            t.is_group,
            t.thread_type,
            t.agent_slug,
            t.created_by,
            p.muted,
            p.is_message_request
     FROM dm_threads t
     JOIN dm_participants p ON p.thread_id = t.id
     WHERE t.id = ? AND p.user_id = ?`
  ).get(threadId, userId);
}

function userCanManageGroup(threadId, userId) {
  const row = db
    .prepare('SELECT 1 FROM dm_threads WHERE id = ? AND is_group = 1 AND created_by = ?')
    .get(threadId, userId);
  return Boolean(row);
}

function createDirectThread(creatorId, targetUserId) {
  const existing = db
    .prepare(
      `SELECT t.id
       FROM dm_threads t
       JOIN dm_participants p1 ON p1.thread_id = t.id AND p1.user_id = ?
       JOIN dm_participants p2 ON p2.thread_id = t.id AND p2.user_id = ?
       WHERE t.is_group = 0
       LIMIT 1`
    )
    .get(creatorId, targetUserId);

  if (existing) {
    return existing.id;
  }

  const targetSettings = getUserSettings(targetUserId);
  const shouldGoToRequests = targetSettings.message_requests_enabled === 1 && !areUsersFriends(creatorId, targetUserId);

  const tx = db.transaction(() => {
    const threadId = db.prepare(
      'INSERT INTO dm_threads (title, icon_emoji, is_group, created_by, thread_type, agent_slug) VALUES (?, ?, 0, ?, ?, ?)'
    ).run('', '', creatorId, 'dm', '')
      .lastInsertRowid;
    db.prepare('INSERT INTO dm_participants (thread_id, user_id, is_message_request) VALUES (?, ?, 0)').run(threadId, creatorId);
    db.prepare('INSERT INTO dm_participants (thread_id, user_id, is_message_request) VALUES (?, ?, ?)').run(threadId, targetUserId, shouldGoToRequests ? 1 : 0);
    return threadId;
  });

  return tx();
}

function createGroupThread({ creatorId, title, iconEmoji, participantIds }) {
  const uniqueIds = [...new Set([creatorId, ...participantIds])];

  const tx = db.transaction(() => {
    const threadId = db.prepare(
      'INSERT INTO dm_threads (title, icon_emoji, is_group, created_by, thread_type, agent_slug) VALUES (?, ?, 1, ?, ?, ?)'
    ).run(title || 'Neue Gruppe', iconEmoji || '', creatorId, 'group_dm', '')
      .lastInsertRowid;

    const insertParticipant = db.prepare('INSERT OR IGNORE INTO dm_participants (thread_id, user_id) VALUES (?, ?)');
    uniqueIds.forEach((userId) => insertParticipant.run(threadId, userId));
    return threadId;
  });

  return tx();
}

function updateGroupThread(threadId, actorId, { title, iconEmoji }) {
  if (!userInThread(threadId, actorId)) {
    return false;
  }

  db.prepare(
    `UPDATE dm_threads
     SET title = ?,
         icon_emoji = ?
     WHERE id = ? AND is_group = 1`
  ).run(title || '', iconEmoji || '', threadId);
  return true;
}

function addParticipantToGroup(threadId, actorId, userId) {
  if (!userInThread(threadId, actorId)) {
    return false;
  }

  db.prepare('INSERT OR IGNORE INTO dm_participants (thread_id, user_id) VALUES (?, ?)').run(threadId, userId);
  return true;
}

function removeParticipantFromGroup(threadId, actorId, userId) {
  if (!userInThread(threadId, actorId) || !userCanManageGroup(threadId, actorId)) {
    return false;
  }

  db.prepare('DELETE FROM dm_participants WHERE thread_id = ? AND user_id = ?').run(threadId, userId);
  return true;
}

function createMessageInThread({
  threadId,
  authorId,
  content,
  attachments = [],
  emojiEntities = [],
  gifIds = [],
  agentSlug = '',
  replyToMessageId = null
}) {
  const tx = db.transaction(() => {
    const messageId = db
      .prepare(
        'INSERT INTO messages (author_id, thread_id, content, kind, agent_slug, reply_to_message_id) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        authorId,
        threadId,
        content,
        'text',
        String(agentSlug || '').trim().toLowerCase(),
        Number(replyToMessageId || 0) || null
      ).lastInsertRowid;

    if (attachments.length) {
      try {
        const insertAttachment = db.prepare(
          `INSERT INTO message_attachments (message_id, kind, mime_type, filename, file_size, url)
           VALUES (?, ?, ?, ?, ?, ?)`
        );
        attachments.forEach((item) => {
          insertAttachment.run(
            messageId,
            item.kind || 'file',
            item.mime_type || '',
            item.filename || '',
            Number(item.file_size || 0),
            item.url || ''
          );
        });
      } catch (error) {
        // Fallback for environments where migration is not yet applied.
      }
    }

    if (emojiEntities.length) {
      try {
        const insertEntity = db.prepare(
          'INSERT INTO message_emoji_entities (message_id, emoji_id, token) VALUES (?, ?, ?)'
        );
        emojiEntities.forEach((entity) => {
          insertEntity.run(messageId, Number(entity.id), String(entity.token || '').slice(0, 80));
        });
      } catch (error) {
        // Optional feature fallback.
      }
    }

    if (gifIds.length) {
      try {
        const insertGif = db.prepare(
          'INSERT INTO message_gif_entities (message_id, gif_id) VALUES (?, ?)'
        );
        const incUsage = db.prepare('UPDATE gif_assets SET usage_count = usage_count + 1 WHERE id = ?');
        gifIds.forEach((gifId) => {
          const numeric = Number(gifId);
          if (!numeric) {
            return;
          }
          insertGif.run(messageId, numeric);
          incUsage.run(numeric);
        });
      } catch (error) {
        // Optional feature fallback.
      }
    }

    return messageId;
  });

  return tx();
}

function listServersForUser(userId) {
  return db
    .prepare(
      `SELECT s.id,
              s.name,
              s.slug,
              s.description,
              s.icon_url,
              s.banner_url,
              s.accent_color,
              s.traits_json
       FROM server_members sm
       JOIN servers s ON s.id = sm.server_id
       WHERE sm.user_id = ?
       ORDER BY s.name`
    )
    .all(userId)
    .map((row) => mapServerRow(row));
}

function getServerMembership(serverId, userId) {
  const row = db
    .prepare(
      `SELECT s.id,
              s.name,
              s.slug,
              s.description,
              s.icon_url,
              s.banner_url,
              s.accent_color,
              s.traits_json,
              s.owner_id,
              sm.role
       FROM server_members sm
       JOIN servers s ON s.id = sm.server_id
       WHERE sm.server_id = ? AND sm.user_id = ?`
    )
    .get(serverId, userId);
  return mapServerRow(row);
}

function canManageServer(serverId, userId) {
  const member = getServerMembership(serverId, userId);
  return Boolean(member && (member.role === 'owner' || member.role === 'admin'));
}

function canInviteToServer(serverId, userId) {
  const member = getServerMembership(serverId, userId);
  return Boolean(member && (member.role === 'owner' || member.role === 'admin'));
}

function getServerAppInstallation(serverId, appId) {
  try {
    const row = db.prepare(
      `SELECT id,
              server_id,
              app_id,
              installed_by_user_id,
              settings_json,
              installed_at,
              updated_at
       FROM server_app_installations
       WHERE server_id = ? AND app_id = ?
       LIMIT 1`
    ).get(serverId, String(appId || '').trim().toLowerCase());

    if (!row) {
      return null;
    }

    return {
      id: Number(row.id || 0),
      server_id: Number(row.server_id || 0),
      app_id: String(row.app_id || ''),
      installed_by_user_id: Number(row.installed_by_user_id || 0),
      settings: parseJsonObject(row.settings_json),
      installed_at: row.installed_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    return null;
  }
}

function upsertServerAppInstallation({ serverId, appId, actorId, settings }) {
  const safeAppId = String(appId || '').trim().toLowerCase();
  if (!Number(serverId || 0) || !safeAppId || !Number(actorId || 0)) {
    return null;
  }

  const payload = JSON.stringify(settings && typeof settings === 'object' ? settings : {});
  try {
    const existing = getServerAppInstallation(serverId, safeAppId);
    if (existing) {
      db.prepare(
        `UPDATE server_app_installations
         SET settings_json = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE server_id = ? AND app_id = ?`
      ).run(payload, serverId, safeAppId);
    } else {
      db.prepare(
        `INSERT INTO server_app_installations
           (server_id, app_id, installed_by_user_id, settings_json)
         VALUES (?, ?, ?, ?)`
      ).run(serverId, safeAppId, actorId, payload);
    }
  } catch (error) {
    return null;
  }

  return getServerAppInstallation(serverId, safeAppId);
}

function removeServerAppInstallation(serverId, appId) {
  try {
    const safeAppId = String(appId || '').trim().toLowerCase();
    const result = db.prepare(
      'DELETE FROM server_app_installations WHERE server_id = ? AND app_id = ?'
    ).run(serverId, safeAppId);
    try {
      db.prepare(
        'DELETE FROM server_app_activity WHERE server_id = ? AND app_id = ?'
      ).run(serverId, safeAppId);
    } catch (_error) {
      // Migration may not be present yet.
    }
    return result.changes > 0;
  } catch (error) {
    return false;
  }
}

function getLatestServerAppActivity(serverId, appId, channelId) {
  const numericServerId = Number(serverId || 0);
  const numericChannelId = Number(channelId || 0);
  const safeAppId = String(appId || '').trim().toLowerCase();
  if (!numericServerId || !numericChannelId || !safeAppId) {
    return null;
  }

  try {
    const row = db.prepare(
      `SELECT created_at
       FROM server_app_activity
       WHERE server_id = ? AND channel_id = ? AND app_id = ?
       ORDER BY id DESC
       LIMIT 1`
    ).get(numericServerId, numericChannelId, safeAppId);
    return row?.created_at || null;
  } catch (error) {
    return null;
  }
}

function countServerAppActivitySince(serverId, appId, sinceIso) {
  const numericServerId = Number(serverId || 0);
  const safeAppId = String(appId || '').trim().toLowerCase();
  const safeSinceIso = String(sinceIso || '').trim();
  if (!numericServerId || !safeAppId || !safeSinceIso) {
    return 0;
  }

  try {
    const row = db.prepare(
      `SELECT COUNT(*) AS total
       FROM server_app_activity
       WHERE server_id = ? AND app_id = ? AND created_at >= ?`
    ).get(numericServerId, safeAppId, safeSinceIso);
    return Math.max(0, Number(row?.total || 0));
  } catch (error) {
    return 0;
  }
}

function recordServerAppActivity({ serverId, channelId, appId, actionType }) {
  const numericServerId = Number(serverId || 0);
  const numericChannelId = Number(channelId || 0);
  const safeAppId = String(appId || '').trim().toLowerCase();
  const safeActionType = String(actionType || 'trigger').trim().toLowerCase().slice(0, 32) || 'trigger';
  if (!numericServerId || !numericChannelId || !safeAppId) {
    return false;
  }

  try {
    db.prepare(
      `INSERT INTO server_app_activity
         (server_id, channel_id, app_id, action_type)
       VALUES (?, ?, ?, ?)`
    ).run(numericServerId, numericChannelId, safeAppId, safeActionType);
    db.prepare(
      `DELETE FROM server_app_activity
       WHERE app_id = ? AND created_at < datetime('now', '-2 days')`
    ).run(safeAppId);
    return true;
  } catch (error) {
    return false;
  }
}

function serverSlugExists(slug) {
  const row = db.prepare('SELECT id FROM servers WHERE slug = ?').get(slug);
  return Boolean(row);
}

function createServerWithDefaults({ name, slug, description, ownerId }) {
  const tx = db.transaction(() => {
    const serverId = db.prepare(
      'INSERT INTO servers (name, slug, description, owner_id) VALUES (?, ?, ?, ?)'
    ).run(name, slug, description || '', ownerId).lastInsertRowid;

    db.prepare('INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(serverId, ownerId, 'owner');
    db.prepare('INSERT INTO channels (server_id, name, type, topic, position) VALUES (?, ?, ?, ?, ?)').run(serverId, 'general', 'text', 'General discussion', 1);
    db.prepare('INSERT INTO channels (server_id, name, type, topic, position) VALUES (?, ?, ?, ?, ?)').run(serverId, 'lounge', 'text', 'Open chat', 2);

    return serverId;
  });

  return tx();
}

function listDiscoverServersForUser(userId, query = '') {
  const q = String(query || '').trim().toLowerCase();
  const hasQuery = q.length > 0;
  const like = `%${q}%`;

  return db.prepare(
    `SELECT s.id,
            s.name,
            s.slug,
            s.description,
            s.icon_url,
            s.banner_url,
            s.accent_color,
            s.traits_json,
            COUNT(sm_all.user_id) AS member_count
     FROM servers s
     LEFT JOIN server_members sm_all ON sm_all.server_id = s.id
     WHERE NOT EXISTS (
       SELECT 1 FROM server_members sm_me
       WHERE sm_me.server_id = s.id AND sm_me.user_id = ?
     )
       AND (? = 0 OR LOWER(s.name) LIKE ? OR LOWER(s.description) LIKE ? OR LOWER(s.slug) LIKE ?)
     GROUP BY s.id, s.name, s.slug, s.description, s.icon_url, s.banner_url, s.accent_color, s.traits_json
     ORDER BY member_count DESC, s.name ASC
     LIMIT 50`
  ).all(userId, hasQuery ? 1 : 0, like, like, like).map((row) => mapServerRow(row));
}

function joinServer(userId, serverId) {
  db.prepare('INSERT OR IGNORE INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(serverId, userId, 'member');
}

function listChannelsForServer(serverId) {
  try {
    return db
      .prepare('SELECT id, name, type, topic, category_id FROM channels WHERE server_id = ? ORDER BY position ASC, id ASC')
      .all(serverId);
  } catch (error) {
    return db
      .prepare('SELECT id, name, type, topic FROM channels WHERE server_id = ? ORDER BY position ASC, id ASC')
      .all(serverId)
      .map((row) => ({ ...row, category_id: null }));
  }
}

function listServerCategories(serverId) {
  try {
    return db
      .prepare('SELECT id, name, position FROM server_categories WHERE server_id = ? ORDER BY position ASC, id ASC')
      .all(serverId);
  } catch (error) {
    return [];
  }
}

function createServerCategory({ serverId, name, actorId }) {
  if (!canManageServer(serverId, actorId)) {
    return { ok: false, code: 'permission_denied' };
  }
  const safeName = String(name || '').trim().slice(0, 60);
  if (!safeName) {
    return { ok: false, code: 'name_required' };
  }
  try {
    const exists = db.prepare('SELECT id FROM server_categories WHERE server_id = ? AND LOWER(name) = LOWER(?)').get(serverId, safeName);
    if (exists) {
      return { ok: false, code: 'name_exists' };
    }
    const positionRow = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM server_categories WHERE server_id = ?').get(serverId);
    const position = Number(positionRow?.next_pos || 1);
    const categoryId = db
      .prepare('INSERT INTO server_categories (server_id, name, position, created_by) VALUES (?, ?, ?, ?)')
      .run(serverId, safeName, position, actorId).lastInsertRowid;
    return { ok: true, category: { id: Number(categoryId), name: safeName, position } };
  } catch (error) {
    return { ok: false, code: 'db_error' };
  }
}

function createServerChannel({ serverId, type, name, topic, categoryId, actorId }) {
  if (!canManageServer(serverId, actorId)) {
    return { ok: false, code: 'permission_denied' };
  }
  const safeType = ['text', 'voice'].includes(String(type || '').toLowerCase()) ? String(type).toLowerCase() : 'text';
  const safeName = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 _-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const safeTopic = String(topic || '').trim().slice(0, 140);
  if (!safeName) {
    return { ok: false, code: 'name_required' };
  }
  const existing = db
    .prepare('SELECT id FROM channels WHERE server_id = ? AND LOWER(name) = LOWER(?)')
    .get(serverId, safeName);
  if (existing) {
    return { ok: false, code: 'name_exists' };
  }
  const categoryValue = Number.isInteger(Number(categoryId)) && Number(categoryId) > 0 ? Number(categoryId) : null;
  if (categoryValue) {
    const category = db.prepare('SELECT id FROM server_categories WHERE id = ? AND server_id = ?').get(categoryValue, serverId);
    if (!category) {
      return { ok: false, code: 'category_invalid' };
    }
  }
  const positionRow = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM channels WHERE server_id = ?').get(serverId);
  const position = Number(positionRow?.next_pos || 1);
  try {
    const channelId = db
      .prepare('INSERT INTO channels (server_id, name, type, topic, position, category_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(serverId, safeName, safeType, safeTopic, position, categoryValue).lastInsertRowid;
    return {
      ok: true,
      channel: { id: Number(channelId), name: safeName, type: safeType, topic: safeTopic, category_id: categoryValue }
    };
  } catch (error) {
    try {
      const channelId = db
        .prepare('INSERT INTO channels (server_id, name, type, topic, position) VALUES (?, ?, ?, ?, ?)')
        .run(serverId, safeName, safeType, safeTopic, position).lastInsertRowid;
      return {
        ok: true,
        channel: { id: Number(channelId), name: safeName, type: safeType, topic: safeTopic, category_id: null }
      };
    } catch (_error) {
      return { ok: false, code: 'db_error' };
    }
  }
}

function updateServerChannel({ serverId, channelId, name, topic, categoryId, actorId }) {
  if (!canManageServer(serverId, actorId)) {
    return { ok: false, code: 'permission_denied' };
  }

  const existing = db
    .prepare('SELECT id FROM channels WHERE id = ? AND server_id = ?')
    .get(channelId, serverId);
  if (!existing) {
    return { ok: false, code: 'channel_not_found' };
  }

  const safeName = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 _-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const safeTopic = String(topic || '').trim().slice(0, 140);
  if (!safeName) {
    return { ok: false, code: 'name_required' };
  }

  const duplicate = db
    .prepare('SELECT id FROM channels WHERE server_id = ? AND LOWER(name) = LOWER(?) AND id != ?')
    .get(serverId, safeName, channelId);
  if (duplicate) {
    return { ok: false, code: 'name_exists' };
  }

  const categoryValue = Number.isInteger(Number(categoryId)) && Number(categoryId) > 0 ? Number(categoryId) : null;
  if (categoryValue) {
    const category = db.prepare('SELECT id FROM server_categories WHERE id = ? AND server_id = ?').get(categoryValue, serverId);
    if (!category) {
      return { ok: false, code: 'category_invalid' };
    }
  }

  try {
    db.prepare(
      `UPDATE channels
       SET name = ?,
           topic = ?,
           category_id = ?
       WHERE id = ? AND server_id = ?`
    ).run(safeName, safeTopic, categoryValue, channelId, serverId);
  } catch (error) {
    db.prepare(
      `UPDATE channels
       SET name = ?,
           topic = ?
       WHERE id = ? AND server_id = ?`
    ).run(safeName, safeTopic, channelId, serverId);
  }

  let updated = null;
  try {
    updated = db
      .prepare('SELECT id, name, type, topic, category_id FROM channels WHERE id = ? AND server_id = ?')
      .get(channelId, serverId);
  } catch (error) {
    updated = db
      .prepare('SELECT id, name, type, topic FROM channels WHERE id = ? AND server_id = ?')
      .get(channelId, serverId);
    if (updated) {
      updated = { ...updated, category_id: null };
    }
  }
  if (!updated) {
    return { ok: false, code: 'channel_not_found' };
  }
  return { ok: true, channel: updated };
}

function deleteServerChannel({ serverId, channelId, actorId }) {
  if (!canManageServer(serverId, actorId)) {
    return { ok: false, code: 'permission_denied' };
  }

  const existing = db
    .prepare('SELECT id FROM channels WHERE id = ? AND server_id = ?')
    .get(channelId, serverId);
  if (!existing) {
    return { ok: false, code: 'channel_not_found' };
  }

  db.prepare('DELETE FROM channels WHERE id = ? AND server_id = ?').run(channelId, serverId);
  return { ok: true };
}

function createServerInvite({ serverId, actorId, expiresOption, maxUses, requireVerification }) {
  if (!canInviteToServer(serverId, actorId)) {
    return { ok: false, code: 'permission_denied' };
  }
  const safeExpires = ['30m', '1d', 'never'].includes(String(expiresOption || '').toLowerCase())
    ? String(expiresOption).toLowerCase()
    : '1d';
  const safeMaxUses = [0, 1, 10, 25, 50].includes(Number(maxUses)) ? Number(maxUses) : 0;
  const expiresAt = safeExpires === 'never'
    ? null
    : new Date(Date.now() + (safeExpires === '30m' ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString();
  const token = nanoid(24);
  try {
    db.prepare(
      `INSERT INTO server_invites
         (server_id, token, created_by, expires_at, max_uses, use_count, require_verification, is_revoked)
       VALUES (?, ?, ?, ?, ?, 0, ?, 0)`
    ).run(serverId, token, actorId, expiresAt, safeMaxUses, requireVerification ? 1 : 0);
    return {
      ok: true,
      invite: {
        token,
        expires_at: expiresAt,
        max_uses: safeMaxUses,
        use_count: 0,
        require_verification: requireVerification ? 1 : 0
      }
    };
  } catch (error) {
    return { ok: false, code: 'db_error' };
  }
}

function listActiveServerInvites(serverId, userId) {
  if (!canInviteToServer(serverId, userId)) {
    return [];
  }
  try {
    return db.prepare(
      `SELECT token, expires_at, max_uses, use_count, require_verification, created_at
       FROM server_invites
       WHERE server_id = ?
         AND is_revoked = 0
         AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
         AND (max_uses = 0 OR use_count < max_uses)
       ORDER BY created_at DESC
       LIMIT 20`
    ).all(serverId);
  } catch (error) {
    return [];
  }
}

function useServerInviteToken(token, userId) {
  const safeToken = String(token || '').trim();
  if (!safeToken) {
    return { ok: false, code: 'invalid_token' };
  }
  const invite = db.prepare(
    `SELECT id, server_id, expires_at, max_uses, use_count, is_revoked
     FROM server_invites
     WHERE token = ?`
  ).get(safeToken);
  if (!invite || invite.is_revoked) {
    return { ok: false, code: 'invalid_token' };
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return { ok: false, code: 'expired' };
  }
  if (invite.max_uses > 0 && invite.use_count >= invite.max_uses) {
    return { ok: false, code: 'exhausted' };
  }

  const already = db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(invite.server_id, userId);
  if (already) {
    return { ok: true, serverId: invite.server_id, alreadyMember: true };
  }

  const tx = db.transaction(() => {
    const updated = db.prepare(
      `UPDATE server_invites
       SET use_count = use_count + 1
       WHERE id = ?
         AND is_revoked = 0
         AND (max_uses = 0 OR use_count < max_uses)`
    ).run(invite.id);
    if (updated.changes === 0) {
      return false;
    }
    db.prepare('INSERT OR IGNORE INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(invite.server_id, userId, 'member');
    return true;
  });

  const ok = tx();
  if (!ok) {
    return { ok: false, code: 'exhausted' };
  }
  return { ok: true, serverId: invite.server_id, alreadyMember: false };
}

function ensureServerNotificationSettings(serverId, userId) {
  db.prepare(
    `INSERT OR IGNORE INTO server_member_notification_settings
       (server_id, user_id, muted_until, notification_level, suppress_everyone, suppress_here)
     VALUES (?, ?, NULL, 'mentions', 0, 0)`
  ).run(serverId, userId);
}

function getServerNotificationSettings(serverId, userId) {
  ensureServerNotificationSettings(serverId, userId);
  return db.prepare(
    `SELECT muted_until, notification_level, suppress_everyone, suppress_here
     FROM server_member_notification_settings
     WHERE server_id = ? AND user_id = ?`
  ).get(serverId, userId);
}

function updateServerNotificationSettings(serverId, userId, { muteDuration, notificationLevel, suppressEveryone, suppressHere }) {
  if (!getServerMembership(serverId, userId)) {
    return { ok: false, code: 'not_member' };
  }
  const safeDuration = ['off', '15m', '1h', '8h', '24h', 'always'].includes(String(muteDuration || '').toLowerCase())
    ? String(muteDuration).toLowerCase()
    : 'off';
  const safeLevel = ['all', 'mentions', 'nothing'].includes(String(notificationLevel || '').toLowerCase())
    ? String(notificationLevel).toLowerCase()
    : 'mentions';
  let mutedUntil = null;
  if (safeDuration === '15m') mutedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  if (safeDuration === '1h') mutedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  if (safeDuration === '8h') mutedUntil = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  if (safeDuration === '24h') mutedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  if (safeDuration === 'always') mutedUntil = '2099-12-31T23:59:59.000Z';
  ensureServerNotificationSettings(serverId, userId);
  db.prepare(
    `UPDATE server_member_notification_settings
     SET muted_until = ?,
         notification_level = ?,
         suppress_everyone = ?,
         suppress_here = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE server_id = ? AND user_id = ?`
  ).run(
    mutedUntil,
    safeLevel,
    suppressEveryone ? 1 : 0,
    suppressHere ? 1 : 0,
    serverId,
    userId
  );
  return { ok: true, settings: getServerNotificationSettings(serverId, userId) };
}

function ensureServerPrivacySettings(serverId, userId) {
  db.prepare(
    `INSERT OR IGNORE INTO server_member_privacy_settings
       (server_id, user_id, dm_permission, explicit_content_filter)
     VALUES (?, ?, 'friends', 'safe')`
  ).run(serverId, userId);
}

function getServerPrivacySettings(serverId, userId) {
  ensureServerPrivacySettings(serverId, userId);
  return db.prepare(
    `SELECT dm_permission, explicit_content_filter
     FROM server_member_privacy_settings
     WHERE server_id = ? AND user_id = ?`
  ).get(serverId, userId);
}

function updateServerPrivacySettings(serverId, userId, { dmPermission, explicitFilter }) {
  if (!getServerMembership(serverId, userId)) {
    return { ok: false, code: 'not_member' };
  }
  const safePermission = ['everyone', 'friends', 'nobody'].includes(String(dmPermission || '').toLowerCase())
    ? String(dmPermission).toLowerCase()
    : 'friends';
  const safeFilter = ['off', 'safe', 'strict'].includes(String(explicitFilter || '').toLowerCase())
    ? String(explicitFilter).toLowerCase()
    : 'safe';
  ensureServerPrivacySettings(serverId, userId);
  db.prepare(
    `UPDATE server_member_privacy_settings
     SET dm_permission = ?,
         explicit_content_filter = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE server_id = ? AND user_id = ?`
  ).run(safePermission, safeFilter, serverId, userId);
  return { ok: true, settings: getServerPrivacySettings(serverId, userId) };
}

function markServerRead(serverId, userId) {
  if (!getServerMembership(serverId, userId)) {
    return { ok: false, code: 'not_member' };
  }
  const channels = listChannelsForServer(serverId);
  const snapshot = [];
  const tx = db.transaction(() => {
    channels.forEach((channel) => {
      const oldRow = db.prepare(
        `SELECT last_read_message_id
         FROM server_channel_reads
         WHERE server_id = ? AND channel_id = ? AND user_id = ?`
      ).get(serverId, channel.id, userId);
      snapshot.push({
        channelId: channel.id,
        lastReadMessageId: oldRow ? oldRow.last_read_message_id : null
      });
      const latest = db.prepare(
        'SELECT id FROM messages WHERE channel_id = ? ORDER BY id DESC LIMIT 1'
      ).get(channel.id);
      const latestId = latest ? latest.id : null;
      db.prepare(
        `INSERT INTO server_channel_reads (server_id, channel_id, user_id, last_read_message_id, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(server_id, channel_id, user_id) DO UPDATE SET
           last_read_message_id = excluded.last_read_message_id,
           updated_at = CURRENT_TIMESTAMP`
      ).run(serverId, channel.id, userId, latestId);
    });
  });
  tx();
  return { ok: true, snapshot };
}

function undoServerMarkRead(serverId, userId, snapshot) {
  if (!getServerMembership(serverId, userId)) {
    return { ok: false, code: 'not_member' };
  }
  if (!Array.isArray(snapshot)) {
    return { ok: false, code: 'invalid_snapshot' };
  }
  const tx = db.transaction(() => {
    snapshot.forEach((entry) => {
      const channelId = Number(entry?.channelId || 0);
      if (!channelId) {
        return;
      }
      const previous = entry?.lastReadMessageId;
      if (previous === null || previous === undefined || previous === '') {
        db.prepare(
          'DELETE FROM server_channel_reads WHERE server_id = ? AND channel_id = ? AND user_id = ?'
        ).run(serverId, channelId, userId);
        return;
      }
      db.prepare(
        `INSERT INTO server_channel_reads (server_id, channel_id, user_id, last_read_message_id, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(server_id, channel_id, user_id) DO UPDATE SET
           last_read_message_id = excluded.last_read_message_id,
           updated_at = CURRENT_TIMESTAMP`
      ).run(serverId, channelId, userId, Number(previous));
    });
  });
  tx();
  return { ok: true };
}

function updateServerOverview(serverId, actorId, {
  name,
  description,
  iconUrl = '',
  bannerUrl = '',
  accentColor = '',
  traits = []
}) {
  if (!canManageServer(serverId, actorId)) {
    return { ok: false, code: 'permission_denied' };
  }
  const safeName = String(name || '').trim().slice(0, 80);
  const safeDescription = String(description || '').trim().slice(0, 240);
  const safeIconUrl = String(iconUrl || '').trim().slice(0, 500);
  const safeBannerUrl = String(bannerUrl || '').trim().slice(0, 500);
  const safeAccentColor = normalizeServerAccentColor(accentColor);
  const safeTraits = normalizeServerTraits(traits, 8);
  if (!safeName) {
    return { ok: false, code: 'name_required' };
  }
  db.prepare(
    `UPDATE servers
     SET name = ?,
         description = ?,
         icon_url = ?,
         banner_url = ?,
         accent_color = ?,
         traits_json = ?
     WHERE id = ?`
  ).run(
    safeName,
    safeDescription,
    safeIconUrl,
    safeBannerUrl,
    safeAccentColor,
    JSON.stringify(safeTraits),
    serverId
  );
  return { ok: true };
}

function leaveServer(serverId, userId, transferOwnerId) {
  const member = getServerMembership(serverId, userId);
  if (!member) {
    return { ok: false, code: 'not_member' };
  }
  const tx = db.transaction(() => {
    if (member.role === 'owner') {
      const nextOwnerId = Number(transferOwnerId || 0);
      if (!nextOwnerId || nextOwnerId === userId) {
        return { ok: false, code: 'owner_transfer_required' };
      }
      const nextMember = db.prepare(
        'SELECT id FROM server_members WHERE server_id = ? AND user_id = ?'
      ).get(serverId, nextOwnerId);
      if (!nextMember) {
        return { ok: false, code: 'transfer_target_invalid' };
      }
      db.prepare('UPDATE servers SET owner_id = ? WHERE id = ?').run(nextOwnerId, serverId);
      db.prepare('UPDATE server_members SET role = ? WHERE server_id = ? AND user_id = ?').run('owner', serverId, nextOwnerId);
      db.prepare('DELETE FROM server_members WHERE server_id = ? AND user_id = ?').run(serverId, userId);
      return { ok: true };
    }
    db.prepare('DELETE FROM server_members WHERE server_id = ? AND user_id = ?').run(serverId, userId);
    return { ok: true };
  });
  return tx();
}

function listMessagesForChannel(channelId, limit = 100) {
  const messages = db
    .prepare(
      `SELECT *
       FROM (
         SELECT m.id,
                m.content,
                m.kind,
                m.agent_slug,
                m.reply_to_message_id,
                m.created_at,
                m.edited_at,
                u.id AS author_id,
                u.username AS author_username,
                u.avatar_url AS author_avatar_url,
                u.presence_status AS author_presence_status,
                CASE WHEN u.is_deactivated = 1 THEN 'Deleted User' ELSE u.display_name END AS author_display_name,
                u.is_system_agent AS author_is_system_agent
         FROM messages m
         JOIN users u ON u.id = m.author_id
         WHERE m.channel_id = ?
         ORDER BY m.id DESC
         LIMIT ?
       ) recent
       ORDER BY recent.id ASC`
    )
    .all(channelId, limit);
  if (!messages.length) {
    return messages;
  }
  return hydrateReplyReferences(hydrateAttachments(messages));
}

function createMessageInChannel({ channelId, authorId, content, attachments = [], emojiEntities = [], gifIds = [], replyToMessageId = null }) {
  const tx = db.transaction(() => {
    const messageId = db
      .prepare('INSERT INTO messages (author_id, channel_id, content, kind, reply_to_message_id) VALUES (?, ?, ?, ?, ?)')
      .run(authorId, channelId, content, 'text', Number(replyToMessageId || 0) || null).lastInsertRowid;

    if (attachments.length) {
      try {
        const insertAttachment = db.prepare(
          `INSERT INTO message_attachments (message_id, kind, mime_type, filename, file_size, url)
           VALUES (?, ?, ?, ?, ?, ?)`
        );
        attachments.forEach((item) => {
          insertAttachment.run(
            messageId,
            item.kind || 'file',
            item.mime_type || '',
            item.filename || '',
            Number(item.file_size || 0),
            item.url || ''
          );
        });
      } catch (error) {
        // Optional feature fallback.
      }
    }

    if (emojiEntities.length) {
      try {
        const insertEntity = db.prepare(
          'INSERT INTO message_emoji_entities (message_id, emoji_id, token) VALUES (?, ?, ?)'
        );
        emojiEntities.forEach((entity) => {
          insertEntity.run(messageId, Number(entity.id), String(entity.token || '').slice(0, 80));
        });
      } catch (error) {
        // Optional feature fallback.
      }
    }

    if (gifIds.length) {
      try {
        const insertGif = db.prepare(
          'INSERT INTO message_gif_entities (message_id, gif_id) VALUES (?, ?)'
        );
        gifIds.forEach((gifId) => {
          insertGif.run(messageId, Number(gifId));
        });
      } catch (error) {
        // Optional feature fallback.
      }
    }

    return messageId;
  });

  return tx();
}

function addReactionToMessage({ messageId, authorId, emoji }) {
  const safeEmoji = String(emoji || '').trim().slice(0, 32);
  const numericMessageId = Number(messageId || 0);
  const numericAuthorId = Number(authorId || 0);
  if (!numericMessageId || !numericAuthorId || !safeEmoji) {
    return null;
  }

  try {
    db.prepare(
      'INSERT OR IGNORE INTO message_reactions (message_id, author_id, emoji) VALUES (?, ?, ?)'
    ).run(numericMessageId, numericAuthorId, safeEmoji);
  } catch (error) {
    return null;
  }

  return getMessageById(numericMessageId);
}

function findMessageActionContext(messageId) {
  return db.prepare(
    `SELECT m.id,
            m.author_id,
            m.thread_id,
            m.channel_id,
            m.kind,
            m.content,
            c.server_id
     FROM messages m
     LEFT JOIN channels c ON c.id = m.channel_id
     WHERE m.id = ?`
  ).get(messageId);
}

function updateMessageForActor({
  messageId,
  actorId,
  content,
  emojiEntities = []
}) {
  const context = findMessageActionContext(messageId);
  if (!context) {
    return { ok: false, code: 'not_found' };
  }

  if (String(context.kind || 'text') !== 'text' || Number(context.author_id || 0) !== Number(actorId || 0)) {
    return { ok: false, code: 'forbidden' };
  }

  if (context.thread_id && !userInThread(context.thread_id, actorId)) {
    return { ok: false, code: 'forbidden' };
  }

  if (context.channel_id && !getServerMembership(context.server_id, actorId)) {
    return { ok: false, code: 'forbidden' };
  }

  const safeContent = String(content || '').trim();
  if (!safeContent) {
    return { ok: false, code: 'empty_content' };
  }

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE messages
       SET content = ?,
           edited_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(safeContent, messageId);

    try {
      db.prepare('DELETE FROM message_emoji_entities WHERE message_id = ?').run(messageId);
      if (emojiEntities.length) {
        const insertEntity = db.prepare(
          'INSERT INTO message_emoji_entities (message_id, emoji_id, token) VALUES (?, ?, ?)'
        );
        emojiEntities.forEach((entity) => {
          insertEntity.run(messageId, Number(entity.id), String(entity.token || '').slice(0, 80));
        });
      }
    } catch (error) {
      // Optional feature fallback.
    }
  });

  tx();

  return {
    ok: true,
    message: getMessageById(messageId)
  };
}

function deleteMessageForActor(messageId, actorId) {
  const context = findMessageActionContext(messageId);
  if (!context) {
    return { ok: false, code: 'not_found' };
  }

  let allowed = false;
  if (context.thread_id) {
    allowed = userInThread(context.thread_id, actorId) && Number(context.author_id || 0) === Number(actorId || 0);
  } else if (context.channel_id) {
    const membership = getServerMembership(context.server_id, actorId);
    allowed = Boolean(membership) && (
      Number(context.author_id || 0) === Number(actorId || 0)
      || canManageServer(context.server_id, actorId)
    );
  }

  if (!allowed) {
    return { ok: false, code: 'forbidden' };
  }

  db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
  return { ok: true };
}

function listMembersForServer(serverId) {
  return db
    .prepare(
      `SELECT u.id,
              u.username,
              CASE WHEN u.is_deactivated = 1 THEN 'Deleted User' ELSE u.display_name END AS display_name,
              u.avatar_url,
              u.presence_status,
              u.custom_status_emoji,
              u.custom_status_text,
              u.custom_status_expires_at,
              sm.role
       FROM server_members sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.server_id = ?
       ORDER BY
         CASE
           WHEN u.presence_status IN ('online', 'idle', 'dnd', 'streaming') THEN 0
           ELSE 1
         END ASC,
         LOWER(u.display_name) ASC`
    )
    .all(serverId);
}

function findUserByUsername(username) {
  return db.prepare(
    'SELECT id, username, display_name, is_deactivated, is_system_agent FROM users WHERE username = ? AND is_system_agent = 0'
  ).get(username.toLowerCase());
}

function searchUsers(term, currentUserId) {
  const like = `%${term.toLowerCase()}%`;
  return db
    .prepare(
      `SELECT id, username, display_name
       FROM users
       WHERE id != ?
         AND is_system_agent = 0
         AND is_deactivated = 0
         AND (LOWER(username) LIKE ? OR LOWER(display_name) LIKE ?)
       ORDER BY display_name
       LIMIT 20`
    )
    .all(currentUserId, like, like);
}

function findUserByHandle(handle, currentUserId) {
  const normalized = String(handle || '').trim().replace(/^@/, '').toLowerCase();
  if (!normalized) {
    return null;
  }
  return db
    .prepare('SELECT id, username, display_name, is_system_agent FROM users WHERE username = ? AND id != ? AND is_system_agent = 0')
    .get(normalized, currentUserId);
}

function listFriendsByTab(userId, tab) {
  if (tab === 'pending') {
    return db
      .prepare(
        `SELECT f.id,
                f.status,
                f.requester_id,
                f.addressee_id,
                u.id AS user_id,
                u.username,
                u.display_name,
                u.avatar_url,
                u.presence_status,
                u.custom_status_emoji,
                u.custom_status_text,
                u.custom_status_expires_at,
                f.created_at,
                'incoming' AS direction
         FROM friendships f
         JOIN users u ON u.id = f.requester_id
         WHERE f.addressee_id = ? AND f.status = 'pending'
         ORDER BY f.created_at DESC`
      )
      .all(userId);
  }

  if (tab === 'blocked') {
    return db
      .prepare(
        `SELECT f.id,
                f.status,
                f.requester_id,
                f.addressee_id,
                u.id AS user_id,
                u.username,
                u.display_name,
                u.avatar_url,
                u.presence_status,
                u.custom_status_emoji,
                u.custom_status_text,
                u.custom_status_expires_at,
                f.created_at,
                CASE WHEN f.requester_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
         WHERE (f.requester_id = ? OR f.addressee_id = ?)
           AND f.status = 'blocked'
         ORDER BY f.created_at DESC`
      )
      .all(userId, userId, userId, userId);
  }

  if (tab === 'online') {
    return db
      .prepare(
        `SELECT f.id,
                f.status,
                u.id AS user_id,
                u.username,
                u.display_name,
                u.avatar_url,
                u.presence_status,
                u.custom_status_emoji,
                u.custom_status_text,
                u.custom_status_expires_at,
                0 AS is_online,
                f.created_at
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
         WHERE (f.requester_id = ? OR f.addressee_id = ?)
           AND f.status = 'accepted'
         ORDER BY u.display_name`
      )
      .all(userId, userId, userId);
  }

  return db
    .prepare(
      `SELECT f.id,
              f.status,
              u.id AS user_id,
              u.username,
              u.display_name,
              u.avatar_url,
              u.presence_status,
              u.custom_status_emoji,
              u.custom_status_text,
              u.custom_status_expires_at,
              0 AS is_online,
              f.created_at
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
       WHERE (f.requester_id = ? OR f.addressee_id = ?)
         AND f.status = 'accepted'
       ORDER BY u.display_name`
    )
    .all(userId, userId, userId);
}

function canSendFriendRequest(requesterId, addresseeId) {
  const target = db.prepare('SELECT is_system_agent FROM users WHERE id = ?').get(addresseeId);
  if (target?.is_system_agent) {
    return false;
  }

  const settings = getUserSettings(addresseeId);
  if (settings.friend_request_permission === 'everyone') {
    return true;
  }
  if (settings.friend_request_permission === 'server_members') {
    return haveSharedServer(requesterId, addresseeId);
  }

  const mutualFriends = db
    .prepare(
      `SELECT 1
       FROM (
         SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS friend_id
         FROM friendships
         WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted'
       ) mine
       JOIN (
         SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS friend_id
         FROM friendships
         WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted'
       ) theirs
       ON mine.friend_id = theirs.friend_id
       LIMIT 1`
    )
    .get(requesterId, requesterId, requesterId, addresseeId, addresseeId, addresseeId);

  return Boolean(mutualFriends);
}

function sendFriendRequest(requesterId, addresseeId) {
  const existing = db
    .prepare(
      `SELECT *
       FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
       LIMIT 1`
    )
    .get(requesterId, addresseeId, addresseeId, requesterId);

  if (existing) {
    if (existing.status === 'blocked') {
      return { ok: false, code: 'blocked' };
    }
    if (existing.status === 'accepted') {
      return { ok: false, code: 'already_friends' };
    }
    if (existing.requester_id === requesterId && existing.status === 'pending') {
      return { ok: false, code: 'already_pending' };
    }

    db.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?").run(existing.id);
    return { ok: true, code: 'accepted' };
  }

  db.prepare("INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')").run(requesterId, addresseeId);
  return { ok: true, code: 'pending' };
}

function resolveFriendRequest(requestId, userId, action) {
  const request = db
    .prepare("SELECT * FROM friendships WHERE id = ? AND addressee_id = ? AND status = 'pending'")
    .get(requestId, userId);

  if (!request) {
    return false;
  }

  if (action === 'accept') {
    db.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?").run(requestId);
    return true;
  }

  db.prepare('DELETE FROM friendships WHERE id = ?').run(requestId);
  return true;
}

function blockUser(requesterId, targetUserId) {
  const existing = db
    .prepare(
      `SELECT *
       FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
       LIMIT 1`
    )
    .get(requesterId, targetUserId, targetUserId, requesterId);

  if (existing) {
    db.prepare("UPDATE friendships SET requester_id = ?, addressee_id = ?, status = 'blocked' WHERE id = ?").run(requesterId, targetUserId, existing.id);
    return;
  }

  db.prepare("INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'blocked')").run(requesterId, targetUserId);
}

function unblockUser(requesterId, targetUserId) {
  db.prepare(
    "DELETE FROM friendships WHERE requester_id = ? AND addressee_id = ? AND status = 'blocked'"
  ).run(requesterId, targetUserId);
}

function canStartDirectDM(senderId, receiverId) {
  const target = db.prepare('SELECT is_system_agent FROM users WHERE id = ?').get(receiverId);
  if (target?.is_system_agent) {
    return false;
  }

  if (isBlockedBetween(senderId, receiverId)) {
    return false;
  }

  const settings = getUserSettings(receiverId);
  if (settings.dm_permission === 'all') {
    return true;
  }

  if (settings.dm_permission === 'server_members') {
    return haveSharedServer(senderId, receiverId);
  }

  return areUsersFriends(senderId, receiverId);
}

function searchMessagesForUser(userId, {
  threadId,
  fromUser,
  has,
  dateFrom,
  dateTo,
  onlyMentions,
  query,
  limit = 40
}) {
  const clauses = [
    'EXISTS (SELECT 1 FROM dm_participants p WHERE p.thread_id = m.thread_id AND p.user_id = ?)'
  ];
  const params = [userId];

  if (threadId) {
    clauses.push('m.thread_id = ?');
    params.push(threadId);
  }

  if (fromUser) {
    clauses.push('LOWER(u.username) = ?');
    params.push(fromUser.toLowerCase());
  }

  if (has === 'link') {
    clauses.push("(m.content LIKE 'http%' OR m.content LIKE '% http%' OR m.content LIKE '%https://%')");
  }

  if (has === 'file') {
    clauses.push("(m.content LIKE '%[GIF] %' OR m.content LIKE '%[FILE] %')");
  }

  if (dateFrom) {
    clauses.push("datetime(m.created_at) >= datetime(?)");
    params.push(dateFrom);
  }

  if (dateTo) {
    clauses.push("datetime(m.created_at) <= datetime(?)");
    params.push(`${dateTo} 23:59:59`);
  }

  if (onlyMentions) {
    clauses.push("LOWER(m.content) LIKE '%@' || LOWER((SELECT username FROM users WHERE id = ?)) || '%'");
    params.push(userId);
  }

  if (query) {
    clauses.push('LOWER(m.content) LIKE ?');
    params.push(`%${query.toLowerCase()}%`);
  }

  const sql = `
    SELECT m.id,
           m.thread_id,
           m.content,
           m.created_at,
           u.username AS author_username,
           CASE WHEN u.is_deactivated = 1 THEN 'Deleted User' ELSE u.display_name END AS author_display_name,
           t.title,
           t.is_group
    FROM messages m
    JOIN users u ON u.id = m.author_id
    JOIN dm_threads t ON t.id = m.thread_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY m.created_at DESC
    LIMIT ?
  `;

  params.push(limit);
  return db.prepare(sql).all(...params);
}

module.exports = {
  createUser,
  findUserByLogin,
  findUserById,
  findUserProfileById,
  countMutualServers,
  countMutualFriends,
  listMutualServers,
  listMutualFriends,
  validatePassword,
  usernameExists,
  emailExists,
  createResetToken,
  findValidResetToken,
  useResetTokenAndUpdatePassword,
  ensureUserSettings,
  getUserSettings,
  updateUserSettings,
  getGlobalSettingsState,
  requestEmailChangeVerification,
  applyEmailVerificationToken,
  updateAccountIdentity,
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
  SOKRATES_AGENT_SLUG,
  SOKRATES_DISPLAY_NAME,
  SOKRATES_ABOUT_ME,
  SOKRATES_AVATAR_URL,
  SOKRATES_BANNER_URL,
  ensureSokratesAgentUser,
  areUsersFriends,
  haveSharedServer,
  isBlockedBetween,
  ensureSokratesThreadForUser,
  isAiDmThread,
  listDMThreadsForUser,
  findThreadByIdForUser,
  listParticipantsForThread,
  listMessagesForThread,
  listMessagesForThreadThroughMessage,
  getLatestMessageIdForThread,
  markThreadRead,
  setThreadMute,
  setThreadMessageRequest,
  userInThread,
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
  updateMessageForActor,
  deleteMessageForActor,
  findMessageActionContext,
  listMembersForServer,
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
  searchMessagesForUser,
  getMessageById,
  findAgentReplyAfterMessage,
  listUserEmojis,
  listAvailableCustomEmojis,
  findUserEmojiByName,
  createUserEmoji,
  listUserEmojisByIds,
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
};
