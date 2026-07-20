import { afterEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { createTestDatabase } from './testing/createTestDatabase'
import {
  DATABASE_MIGRATIONS,
  getAppliedMigrations,
  runDatabaseMigrations,
  type DatabaseMigration
} from './migrationRunner'

describe('database migrations', () => {
  const databases: Database.Database[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('initializes a new database and records every migration once', () => {
    const db = createTestDatabase()
    databases.push(db)

    expect(getAppliedMigrations(db).map((migration) => migration.version)).toEqual(
      DATABASE_MIGRATIONS.map((migration) => migration.version)
    )
    expect(columnNames(db, 'playlist_songs')).toContain('added_at')
    expect(columnNames(db, 'export_records')).toEqual(
      expect.arrayContaining(['scope', 'sort_mode', 'source_type', 'source_id', 'source_name'])
    )

    runDatabaseMigrations(db)
    expect(getAppliedMigrations(db)).toHaveLength(DATABASE_MIGRATIONS.length)
  })

  it('adopts an existing v0.2.3 schema without losing data', () => {
    const db = createBareTestDatabase()
    databases.push(db)
    db.exec(`
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
        description TEXT, cover_url TEXT, track_count INTEGER, owner_user_id TEXT,
        owner_nickname TEXT, type TEXT NOT NULL, subscribed INTEGER, special_type INTEGER,
        play_count INTEGER, update_time INTEGER, create_time INTEGER, raw_data TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE playlist_songs (
        id TEXT PRIMARY KEY, playlist_id TEXT NOT NULL, song_id TEXT NOT NULL,
        order_index INTEGER, added_at INTEGER, created_at TEXT NOT NULL
      );
      CREATE TABLE export_records (
        id TEXT PRIMARY KEY, export_type TEXT NOT NULL, file_path TEXT NOT NULL,
        song_count INTEGER NOT NULL, scope TEXT, sort_mode TEXT, source_type TEXT,
        source_id TEXT, source_name TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE app_settings (
        id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, value TEXT, updated_at TEXT NOT NULL
      );
      INSERT INTO songs (
        id, ncm_song_id, name, artists_json, created_at, updated_at
      ) VALUES ('song-1', '1', 'Existing song', '[]', 'now', 'now');
    `)

    runDatabaseMigrations(db)

    const song = db.prepare('SELECT name FROM songs WHERE id = ?').get('song-1') as {
      name: string
    }
    expect(song.name).toBe('Existing song')
    expect(getAppliedMigrations(db)).toHaveLength(DATABASE_MIGRATIONS.length)
  })

  it('opens a representative v0.2.4 database without changing user data', () => {
    const db = createBareTestDatabase()
    databases.push(db)
    db.exec(readFileSync(new URL('./testing/fixtures/v0.2.4.sql', import.meta.url), 'utf8'))

    runDatabaseMigrations(db)

    expect(getAppliedMigrations(db)).toHaveLength(DATABASE_MIGRATIONS.length)
    expect(db.prepare('SELECT name FROM songs WHERE id = ?').get('song-1')).toEqual({
      name: 'v0.2.4 song'
    })
    expect(db.prepare('SELECT COUNT(*) AS count FROM playlist_songs').get()).toEqual({ count: 1 })
    expect(db.prepare('SELECT value FROM app_settings WHERE key = ?').get('secret:cookie')).toEqual(
      {
        value: 'must-not-leak'
      }
    )
  })

  it('rolls back a failed migration and does not record its version', () => {
    const db = createBareTestDatabase()
    databases.push(db)
    const migrations: DatabaseMigration[] = [
      {
        version: 99,
        name: 'intentional failure',
        up: (database) => {
          database.exec('CREATE TABLE should_rollback (id TEXT);')
          throw new Error('boom')
        }
      }
    ]

    expect(() => runDatabaseMigrations(db, migrations)).toThrow('数据库迁移失败：v99')
    expect(getAppliedMigrations(db)).toEqual([])
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'should_rollback'")
      .get()
    expect(table).toBeUndefined()
  })
})

function columnNames(db: Database.Database, tableName: string): string[] {
  return (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map(
    (column) => column.name
  )
}

function createBareTestDatabase(): Database.Database {
  const db = createTestDatabase()
  db.exec(`
    DROP TABLE schema_migrations;
    DROP TABLE export_records;
    DROP TABLE playlist_songs;
    DROP TABLE playlists;
    DROP TABLE songs;
    DROP TABLE users;
    DROP TABLE app_settings;
  `)
  return db
}
