CREATE TABLE IF NOT EXISTS ai_dm_threads (
  user_id INTEGER NOT NULL,
  thread_id INTEGER NOT NULL,
  agent_slug TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS ai_dm_threads__rebuilt;

CREATE TABLE IF NOT EXISTS ai_dm_threads__rebuilt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  agent_key TEXT NOT NULL,
  agent_slug TEXT NOT NULL DEFAULT '',
  thread_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, agent_key),
  UNIQUE(thread_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id) REFERENCES dm_threads(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO ai_dm_threads__rebuilt (user_id, agent_key, agent_slug, thread_id, created_at)
SELECT
  user_id,
  COALESCE(NULLIF(agent_slug, ''), 'sokrates'),
  COALESCE(NULLIF(agent_slug, ''), 'sokrates'),
  thread_id,
  COALESCE(created_at, CURRENT_TIMESTAMP)
FROM ai_dm_threads
WHERE user_id IS NOT NULL
  AND thread_id IS NOT NULL;

DROP TABLE ai_dm_threads;
ALTER TABLE ai_dm_threads__rebuilt RENAME TO ai_dm_threads;

CREATE INDEX IF NOT EXISTS idx_ai_dm_threads_agent_lookup
  ON ai_dm_threads(agent_key, user_id);
