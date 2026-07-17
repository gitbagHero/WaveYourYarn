import type { Database } from 'better-sqlite3'
import { nowIso } from '../utils/time'
import { createInitialSchema, ensureColumn } from './schema'

export interface DatabaseMigration {
  version: number
  name: string
  up: (db: Database) => void
}

export const DATABASE_MIGRATIONS: DatabaseMigration[] = [
  {
    version: 1,
    name: 'initial schema',
    up: createInitialSchema
  },
  {
    version: 2,
    name: 'playlist song added time',
    up: (db) => ensureColumn(db, 'playlist_songs', 'added_at', 'INTEGER')
  },
  {
    version: 3,
    name: 'export record scope and sort mode',
    up: (db) => {
      ensureColumn(db, 'export_records', 'scope', 'TEXT')
      ensureColumn(db, 'export_records', 'sort_mode', 'TEXT')
    }
  },
  {
    version: 4,
    name: 'extended playlist metadata',
    up: (db) => {
      ensureColumn(db, 'playlists', 'owner_user_id', 'TEXT')
      ensureColumn(db, 'playlists', 'owner_nickname', 'TEXT')
      ensureColumn(db, 'playlists', 'subscribed', 'INTEGER')
      ensureColumn(db, 'playlists', 'special_type', 'INTEGER')
      ensureColumn(db, 'playlists', 'play_count', 'INTEGER')
      ensureColumn(db, 'playlists', 'update_time', 'INTEGER')
      ensureColumn(db, 'playlists', 'create_time', 'INTEGER')
    }
  },
  {
    version: 5,
    name: 'export record source metadata',
    up: (db) => {
      ensureColumn(db, 'export_records', 'source_type', 'TEXT')
      ensureColumn(db, 'export_records', 'source_id', 'TEXT')
      ensureColumn(db, 'export_records', 'source_name', 'TEXT')
    }
  },
  {
    version: 6,
    name: 'query indexes',
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_order
          ON playlist_songs (playlist_id, order_index);
        CREATE INDEX IF NOT EXISTS idx_playlist_songs_song
          ON playlist_songs (song_id);
        CREATE INDEX IF NOT EXISTS idx_playlists_type
          ON playlists (type);
        CREATE INDEX IF NOT EXISTS idx_export_records_created
          ON export_records (created_at DESC);
      `)
    }
  }
]

export function runDatabaseMigrations(
  db: Database,
  migrations: DatabaseMigration[] = DATABASE_MIGRATIONS
): void {
  validateMigrations(migrations)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)

  const appliedVersions = new Set(getAppliedMigrations(db).map((migration) => migration.version))

  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (appliedVersions.has(migration.version)) {
      continue
    }

    const applyMigration = db.transaction(() => {
      migration.up(db)
      db.prepare(
        `INSERT INTO schema_migrations (version, name, applied_at)
         VALUES (?, ?, ?)`
      ).run(migration.version, migration.name, nowIso())
    })

    try {
      applyMigration()
    } catch (error) {
      throw new Error(`数据库迁移失败：v${migration.version} ${migration.name}`, { cause: error })
    }
  }
}

export function getAppliedMigrations(
  db: Database
): Array<{ version: number; name: string; appliedAt: string }> {
  if (!hasTable(db, 'schema_migrations')) {
    return []
  }

  const rows = db
    .prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC')
    .all() as Array<{ version: number; name: string; applied_at: string }>

  return rows.map((row) => ({
    version: row.version,
    name: row.name,
    appliedAt: row.applied_at
  }))
}

function hasTable(db: Database, tableName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name: string } | undefined
  return Boolean(row)
}

function validateMigrations(migrations: DatabaseMigration[]): void {
  const versions = new Set<number>()

  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version <= 0) {
      throw new Error(`数据库迁移版本无效：${migration.version}`)
    }

    if (versions.has(migration.version)) {
      throw new Error(`数据库迁移版本重复：${migration.version}`)
    }

    versions.add(migration.version)
  }
}
