ALTER TABLE playlists ADD COLUMN owner_user_id TEXT;
ALTER TABLE playlists ADD COLUMN owner_nickname TEXT;
ALTER TABLE playlists ADD COLUMN subscribed INTEGER;
ALTER TABLE playlists ADD COLUMN special_type INTEGER;
ALTER TABLE playlists ADD COLUMN play_count INTEGER;
ALTER TABLE playlists ADD COLUMN update_time INTEGER;
ALTER TABLE playlists ADD COLUMN create_time INTEGER;
