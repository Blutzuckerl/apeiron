ALTER TABLE user_settings ADD COLUMN gif_favorites_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE user_settings ADD COLUMN gif_recents_json TEXT NOT NULL DEFAULT '[]';
