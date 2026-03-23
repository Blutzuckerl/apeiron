ALTER TABLE user_emojis ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private', 'public'));

CREATE INDEX IF NOT EXISTS idx_user_emojis_visibility ON user_emojis(visibility, id);
