CREATE TABLE users (
  id TEXT PRIMARY KEY, ncm_user_id TEXT NOT NULL, nickname TEXT NOT NULL,
  avatar_url TEXT, raw_data TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE songs (
  id TEXT PRIMARY KEY, ncm_song_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  artists_json TEXT NOT NULL, album TEXT, duration INTEGER, cover_url TEXT,
  alias_json TEXT, raw_data TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE playlists (
  id TEXT PRIMARY KEY, ncm_playlist_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  description TEXT, cover_url TEXT, track_count INTEGER, type TEXT NOT NULL,
  raw_data TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  owner_user_id TEXT, owner_nickname TEXT, subscribed INTEGER, special_type INTEGER,
  play_count INTEGER, update_time INTEGER, create_time INTEGER
);
CREATE TABLE playlist_songs (
  id TEXT PRIMARY KEY, playlist_id TEXT NOT NULL, song_id TEXT NOT NULL,
  order_index INTEGER, created_at TEXT NOT NULL, added_at INTEGER
);
CREATE TABLE export_records (
  id TEXT PRIMARY KEY, export_type TEXT NOT NULL, file_path TEXT NOT NULL,
  song_count INTEGER NOT NULL, created_at TEXT NOT NULL, scope TEXT, sort_mode TEXT,
  source_type TEXT, source_id TEXT, source_name TEXT
);
CREATE TABLE app_settings (
  id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, value TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL
);

CREATE INDEX idx_playlist_songs_playlist_order ON playlist_songs (playlist_id, order_index);
CREATE INDEX idx_playlist_songs_song ON playlist_songs (song_id);
CREATE INDEX idx_playlists_type ON playlists (type);
CREATE INDEX idx_export_records_created ON export_records (created_at DESC);

INSERT INTO schema_migrations VALUES
  (1, 'initial schema', '2026-07-01T00:00:00.000Z'),
  (2, 'playlist song added time', '2026-07-01T00:00:00.000Z'),
  (3, 'export record scope and sort mode', '2026-07-01T00:00:00.000Z'),
  (4, 'extended playlist metadata', '2026-07-01T00:00:00.000Z'),
  (5, 'export record source metadata', '2026-07-01T00:00:00.000Z'),
  (6, 'query indexes', '2026-07-01T00:00:00.000Z');
INSERT INTO users VALUES
  ('user-1', '10001', 'v0.2.4 user', NULL, NULL, '2026-07-01', '2026-07-01');
INSERT INTO songs VALUES
  ('song-1', '20001', 'v0.2.4 song', '["Artist"]', 'Album', 180000, NULL, '[]', NULL, '2026-07-01', '2026-07-01');
INSERT INTO playlists VALUES
  ('playlist-1', '30001', 'v0.2.4 playlist', NULL, NULL, 1, 'created', NULL,
   '2026-07-01', '2026-07-01', '10001', 'v0.2.4 user', 0, 0, 1, 1, 1);
INSERT INTO playlist_songs VALUES
  ('relation-1', 'playlist-1', 'song-1', 0, '2026-07-01', 1719792000000);
INSERT INTO export_records VALUES
  ('export-1', 'csv', '/tmp/v0.2.4.csv', 1, '2026-07-01', 'all', 'timeDesc',
   'playlist', 'playlist-1', 'v0.2.4 playlist');
INSERT INTO app_settings VALUES
  ('setting-1', 'theme', 'system', '2026-07-01'),
  ('setting-2', 'secret:cookie', 'must-not-leak', '2026-07-01');
