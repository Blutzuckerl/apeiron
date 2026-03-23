CREATE TABLE IF NOT EXISTS user_emojis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_emoji_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  emoji_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (emoji_id) REFERENCES user_emojis(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_emojis_user ON user_emojis(user_id, id);
CREATE INDEX IF NOT EXISTS idx_msg_emoji_entities_msg ON message_emoji_entities(message_id, id);
