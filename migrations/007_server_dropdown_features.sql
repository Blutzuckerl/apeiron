ALTER TABLE channels ADD COLUMN category_id INTEGER;

CREATE TABLE IF NOT EXISTS server_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(server_id, name),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_by INTEGER NOT NULL,
  expires_at TEXT,
  max_uses INTEGER NOT NULL DEFAULT 0,
  use_count INTEGER NOT NULL DEFAULT 0,
  require_verification INTEGER NOT NULL DEFAULT 0,
  is_revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_member_notification_settings (
  server_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  muted_until TEXT,
  notification_level TEXT NOT NULL DEFAULT 'mentions' CHECK(notification_level IN ('all', 'mentions', 'nothing')),
  suppress_everyone INTEGER NOT NULL DEFAULT 0,
  suppress_here INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (server_id, user_id),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_member_privacy_settings (
  server_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  dm_permission TEXT NOT NULL DEFAULT 'friends' CHECK(dm_permission IN ('everyone', 'friends', 'nobody')),
  explicit_content_filter TEXT NOT NULL DEFAULT 'safe' CHECK(explicit_content_filter IN ('off', 'safe', 'strict')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (server_id, user_id),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_channel_reads (
  server_id INTEGER NOT NULL,
  channel_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  last_read_message_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (server_id, channel_id, user_id),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_server_categories_server ON server_categories(server_id, position, id);
CREATE INDEX IF NOT EXISTS idx_server_invites_server ON server_invites(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_invites_token ON server_invites(token);
CREATE INDEX IF NOT EXISTS idx_server_channel_reads_server_user ON server_channel_reads(server_id, user_id, channel_id);
