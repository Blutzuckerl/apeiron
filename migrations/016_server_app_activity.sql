CREATE TABLE IF NOT EXISTS server_app_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL,
  channel_id INTEGER,
  app_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_server_app_activity_server
  ON server_app_activity(server_id, app_id, created_at);

CREATE INDEX IF NOT EXISTS idx_server_app_activity_channel
  ON server_app_activity(server_id, channel_id, app_id, created_at);
