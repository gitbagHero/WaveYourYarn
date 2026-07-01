import Database from 'better-sqlite3'
import { getDatabasePath } from '../utils/paths'
import { logger } from '../utils/logger'

let database: Database.Database | null = null

const INIT_MIGRATION = `
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
  added_at INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS export_records (
  id TEXT PRIMARY KEY,
  export_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  song_count INTEGER NOT NULL,
  scope TEXT,
  sort_mode TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TEXT NOT NULL
);
`

export function getDatabase(): Database.Database {
  if (!database) {
    database = new Database(getDatabasePath())
  }

  return database
}

export function initializeDatabase(): void {
  const db = getDatabase()
  db.exec(INIT_MIGRATION)
  ensureColumn(db, 'playlist_songs', 'added_at', 'INTEGER')
  ensureColumn(db, 'export_records', 'scope', 'TEXT')
  ensureColumn(db, 'export_records', 'sort_mode', 'TEXT')
  logger.info('SQLite database initialized')
}

function ensureColumn(
  db: Database.Database,
  tableName: string,
  columnName: string,
  columnDefinition: string
): void {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  const hasColumn = columns.some((column) => column.name === columnName)

  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`)
  }
}
