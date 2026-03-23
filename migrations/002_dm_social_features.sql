ALTER TABLE dm_threads ADD COLUMN icon_emoji TEXT DEFAULT '';
ALTER TABLE dm_participants ADD COLUMN muted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dm_participants ADD COLUMN is_message_request INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN is_deactivated INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY,
  dm_permission TEXT NOT NULL DEFAULT 'all' CHECK(dm_permission IN ('all', 'server_members', 'friends')),
  friend_request_permission TEXT NOT NULL DEFAULT 'everyone' CHECK(friend_request_permission IN ('everyone', 'friends_of_friends', 'server_members')),
  message_requests_enabled INTEGER NOT NULL DEFAULT 0,
  block_history_mode TEXT NOT NULL DEFAULT 'visible' CHECK(block_history_mode IN ('visible', 'hidden')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status ON friendships(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_requester_status ON friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_dm_participants_user_thread ON dm_participants(user_id, thread_id);
