ALTER TABLE users ADD COLUMN is_system_agent INTEGER NOT NULL DEFAULT 0;

ALTER TABLE dm_threads ADD COLUMN thread_type TEXT NOT NULL DEFAULT 'dm';
ALTER TABLE dm_threads ADD COLUMN agent_slug TEXT NOT NULL DEFAULT '';
UPDATE dm_threads
SET thread_type = CASE WHEN is_group = 1 THEN 'group_dm' ELSE 'dm' END
WHERE thread_type = 'dm';

ALTER TABLE messages ADD COLUMN agent_slug TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS ai_dm_threads (
  user_id INTEGER PRIMARY KEY,
  thread_id INTEGER NOT NULL UNIQUE,
  agent_slug TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id) REFERENCES dm_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_system_agent ON users(is_system_agent, username);
CREATE INDEX IF NOT EXISTS idx_dm_threads_type_agent ON dm_threads(thread_type, agent_slug);
CREATE INDEX IF NOT EXISTS idx_messages_thread_agent ON messages(thread_id, agent_slug, id);
