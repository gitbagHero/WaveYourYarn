CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  ncm_user_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  raw_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  ncm_song_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  artists_json TEXT NOT NULL,
  album TEXT,
  duration INTEGER,
  cover_url TEXT,
  alias_json TEXT,
  raw_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  ncm_playlist_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  track_count INTEGER,
  type TEXT NOT NULL,
  raw_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_songs (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  song_id TEXT NOT NULL,
  order_index INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS export_records (
  id TEXT PRIMARY KEY,
  export_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  song_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TEXT NOT NULL
);
