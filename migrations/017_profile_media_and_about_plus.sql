CREATE TABLE IF NOT EXISTS user_profile_extras (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  about_plus_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_profile_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  file_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  effect_name TEXT NOT NULL DEFAULT 'none',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profile_media_user_id_created_at
  ON user_profile_media (user_id, created_at DESC, id DESC);
