CREATE TABLE IF NOT EXISTS game_cover_cache (
  normalized_name TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'igdb',
  matched_name TEXT NOT NULL DEFAULT '',
  image_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  local_file_url TEXT NOT NULL DEFAULT '',
  attribution TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_found',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_cover_cache_expires_at
  ON game_cover_cache (expires_at);
