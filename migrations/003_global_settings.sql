ALTER TABLE users ADD COLUMN banner_url TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN presence_status TEXT NOT NULL DEFAULT 'online' CHECK(presence_status IN ('online', 'idle', 'dnd', 'invisible'));
ALTER TABLE users ADD COLUMN custom_status_emoji TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN custom_status_text TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN custom_status_expires_at TEXT;
ALTER TABLE users ADD COLUMN pending_email TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE user_settings ADD COLUMN notifications_desktop INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN notifications_sounds INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN notifications_mentions TEXT NOT NULL DEFAULT 'me' CHECK(notifications_mentions IN ('me', 'roles', 'all'));
ALTER TABLE user_settings ADD COLUMN appearance_theme TEXT NOT NULL DEFAULT 'dark' CHECK(appearance_theme IN ('dark', 'light'));
ALTER TABLE user_settings ADD COLUMN appearance_font_scale INTEGER NOT NULL DEFAULT 100;
ALTER TABLE user_settings ADD COLUMN appearance_density TEXT NOT NULL DEFAULT 'cozy' CHECK(appearance_density IN ('compact', 'cozy'));
ALTER TABLE user_settings ADD COLUMN appearance_avatar_grouping TEXT NOT NULL DEFAULT 'always' CHECK(appearance_avatar_grouping IN ('always', 'grouped'));
ALTER TABLE user_settings ADD COLUMN appearance_reduced_motion INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN accessibility_screen_reader_hints INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN accessibility_high_contrast INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN voice_input_device TEXT NOT NULL DEFAULT 'Default Microphone';
ALTER TABLE user_settings ADD COLUMN voice_output_device TEXT NOT NULL DEFAULT 'Default Speakers';
ALTER TABLE user_settings ADD COLUMN voice_input_sensitivity INTEGER NOT NULL DEFAULT 50;
ALTER TABLE user_settings ADD COLUMN voice_echo_cancellation INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN voice_noise_suppression INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN voice_camera_device TEXT NOT NULL DEFAULT 'Default Camera';
ALTER TABLE user_settings ADD COLUMN voice_ptt_key TEXT NOT NULL DEFAULT 'V';
ALTER TABLE user_settings ADD COLUMN app_language TEXT NOT NULL DEFAULT 'de';
ALTER TABLE user_settings ADD COLUMN connections_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS email_verify_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  new_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verify_token ON email_verify_tokens(token);
