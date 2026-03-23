ALTER TABLE user_settings ADD COLUMN emoji_favorites_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE user_settings ADD COLUMN emoji_recents_json TEXT NOT NULL DEFAULT '[]';
