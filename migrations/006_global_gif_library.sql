CREATE TABLE IF NOT EXISTS gif_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL UNIQUE,
  tags TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'image/gif',
  file_size INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  url TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_gif_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  gif_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (gif_id) REFERENCES gif_assets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gif_assets_usage ON gif_assets(usage_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_gif_entities_message ON message_gif_entities(message_id, id);
