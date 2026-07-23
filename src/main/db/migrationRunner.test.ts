import { afterEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { createTestDatabase } from './testing/createTestDatabase'
import {
  CURRENT_DATABASE_SCHEMA_VERSION,
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
    expect(CURRENT_DATABASE_SCHEMA_VERSION).toBe(8)
    expect(DATABASE_MIGRATIONS.map(({ version, name }) => ({ version, name }))).toEqual([
      { version: 1, name: 'initial schema' },
      { version: 2, name: 'playlist song added time' },
      { version: 3, name: 'export record scope and sort mode' },
      { version: 4, name: 'extended playlist metadata' },
      { version: 5, name: 'export record source metadata' },
      { version: 6, name: 'query indexes' },
      { version: 7, name: 'llm profiles jobs and disclosure consents' },
      { version: 8, name: 'ai reports and source snapshots' }
    ])
    expect(columnNames(db, 'playlist_songs')).toContain('added_at')
    expect(columnNames(db, 'export_records')).toEqual(
      expect.arrayContaining(['scope', 'sort_mode', 'source_type', 'source_id', 'source_name'])
    )
    expect(tableNames(db)).toEqual(
      expect.arrayContaining([
        'llm_profiles',
        'job_runs',
        'ai_disclosure_consents',
        'ai_reports',
        'ai_report_sources'
      ])
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

  it('upgrades a schema 6 database to the current schema without changing existing data', () => {
    const db = createBareTestDatabase()
    databases.push(db)
    const schemaSixMigrations = DATABASE_MIGRATIONS.filter(({ version }) => version <= 6)
    runDatabaseMigrations(db, schemaSixMigrations)
    db.prepare(
      `INSERT INTO songs (
        id, ncm_song_id, name, artists_json, created_at, updated_at
      ) VALUES ('schema-6-song', '600', 'Schema 6 song', '[]', 'now', 'now')`
    ).run()

    runDatabaseMigrations(db)

    expect(db.prepare('SELECT name FROM songs WHERE id = ?').get('schema-6-song')).toEqual({
      name: 'Schema 6 song'
    })
    expect(getAppliedMigrations(db).at(-1)?.version).toBe(8)
    expect(tableNames(db)).toEqual(
      expect.arrayContaining([
        'llm_profiles',
        'job_runs',
        'ai_disclosure_consents',
        'ai_reports',
        'ai_report_sources'
      ])
    )
  })

  it('upgrades schema 7 to schema 8 without changing LLM profiles or jobs', () => {
    const db = createBareTestDatabase()
    databases.push(db)
    runDatabaseMigrations(
      db,
      DATABASE_MIGRATIONS.filter(({ version }) => version <= 7)
    )
    db.prepare(
      `INSERT INTO llm_profiles (
        id, name, protocol, base_url, model_id, timeout_ms, output_mode, language,
        max_input_songs, secret_ref, is_active, created_at, updated_at
      ) VALUES (
        'profile-7', 'Schema 7 profile', 'openai_chat_completions',
        'https://llm.example.test/v1', 'schema-7-model', 60000, 'json_object',
        'zh-CN', 100, 'llm-profile:profile-7:api-key', 1, 'now', 'now'
      )`
    ).run()
    db.prepare(
      `INSERT INTO job_runs (
        id, kind, profile_id, status, stage, input_summary_json, created_at
      ) VALUES (
        'job-7', 'ai_report_generation', 'profile-7', 'succeeded', 'completed', '{}', 'now'
      )`
    ).run()

    runDatabaseMigrations(db)

    expect(db.prepare('SELECT name FROM llm_profiles WHERE id = ?').get('profile-7')).toEqual({
      name: 'Schema 7 profile'
    })
    expect(db.prepare('SELECT status FROM job_runs WHERE id = ?').get('job-7')).toEqual({
      status: 'succeeded'
    })
    expect(getAppliedMigrations(db).at(-1)?.version).toBe(8)
    expect(tableNames(db)).toEqual(expect.arrayContaining(['ai_reports', 'ai_report_sources']))
  })

  it('enforces profile, progress and disclosure ownership constraints', () => {
    const db = createTestDatabase()
    databases.push(db)
    const insertProfile = db.prepare(
      `INSERT INTO llm_profiles (
        id, name, protocol, base_url, model_id, timeout_ms, output_mode, language,
        max_input_songs, secret_ref, is_active, created_at, updated_at
      ) VALUES (
        @id, @name, 'openai_chat_completions', 'https://llm.example.test/v1', 'test-model',
        60000, 'json_object', 'zh-CN', @maxInputSongs, @secretRef, @isActive, 'now', 'now'
      )`
    )
    insertProfile.run({
      id: 'profile-1',
      name: 'Primary',
      maxInputSongs: 100,
      secretRef: 'llm-profile:profile-1:api-key',
      isActive: 1
    })

    expect(() =>
      insertProfile.run({
        id: 'profile-2',
        name: 'Second active',
        maxInputSongs: 100,
        secretRef: 'llm-profile:profile-2:api-key',
        isActive: 1
      })
    ).toThrow()
    expect(() =>
      insertProfile.run({
        id: 'profile-too-large',
        name: 'Too large',
        maxInputSongs: 101,
        secretRef: 'llm-profile:profile-too-large:api-key',
        isActive: 0
      })
    ).toThrow()

    db.prepare(
      `INSERT INTO ai_disclosure_consents (
        id, profile_id, target_origin, protocol, source_type, source_id,
        fields_hash, max_input_songs, created_at, updated_at
      ) VALUES (
        'consent-1', 'profile-1', 'https://llm.example.test',
        'openai_chat_completions', 'liked', NULL, 'sha256:fields', 100, 'now', 'now'
      )`
    ).run()
    db.prepare(
      `INSERT INTO job_runs (
        id, kind, profile_id, status, stage, progress_current, progress_total,
        input_summary_json, created_at
      ) VALUES (
        'job-1', 'llm_connection_test', 'profile-1', 'running', 'requesting',
        0, 1, '{}', 'now'
      )`
    ).run()

    expect(() =>
      db
        .prepare(
          `INSERT INTO ai_disclosure_consents (
          id, profile_id, target_origin, protocol, source_type, source_id,
          fields_hash, max_input_songs, created_at, updated_at
        ) VALUES (
          'orphan', 'missing-profile', 'https://llm.example.test',
          'openai_chat_completions', 'liked', NULL, 'sha256:fields', 100, 'now', 'now'
        )`
        )
        .run()
    ).toThrow()
    expect(() =>
      db
        .prepare(
          `INSERT INTO job_runs (
          id, kind, status, stage, progress_current, progress_total,
          input_summary_json, created_at
        ) VALUES (
          'invalid-progress', 'llm_connection_test', 'running', 'requesting',
          2, 1, '{}', 'now'
        )`
        )
        .run()
    ).toThrow()

    db.prepare('DELETE FROM llm_profiles WHERE id = ?').run('profile-1')
    expect(db.prepare('SELECT COUNT(*) AS count FROM ai_disclosure_consents').get()).toEqual({
      count: 0
    })
    expect(db.prepare('SELECT profile_id FROM job_runs WHERE id = ?').get('job-1')).toEqual({
      profile_id: null
    })
  })

  it('rolls back a failed migration and does not record its version', () => {
    const db = createBareTestDatabase()
    databases.push(db)
    const failedVersion = CURRENT_DATABASE_SCHEMA_VERSION + 1
    const migrations: DatabaseMigration[] = [
      ...DATABASE_MIGRATIONS,
      {
        version: failedVersion,
        name: 'intentional failure',
        up: (database) => {
          database.exec('CREATE TABLE should_rollback (id TEXT);')
          throw new Error('boom')
        }
      }
    ]

    expect(() => runDatabaseMigrations(db, migrations)).toThrow(`数据库迁移失败：v${failedVersion}`)
    expect(getAppliedMigrations(db).map(({ version }) => version)).toEqual(
      DATABASE_MIGRATIONS.map(({ version }) => version)
    )
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'should_rollback'")
      .get()
    expect(table).toBeUndefined()
  })

  it('rejects duplicate, missing and unnamed migration registry entries before applying them', () => {
    const db = createBareTestDatabase()
    databases.push(db)
    const noop = (): void => undefined

    expect(() =>
      runDatabaseMigrations(db, [
        { version: 1, name: 'one', up: noop },
        { version: 1, name: 'duplicate', up: noop }
      ])
    ).toThrow('数据库迁移版本重复：1')

    expect(() =>
      runDatabaseMigrations(db, [
        { version: 1, name: 'one', up: noop },
        { version: 3, name: 'three', up: noop }
      ])
    ).toThrow('数据库迁移版本不连续：期望 v2，实际 v3')

    expect(() => runDatabaseMigrations(db, [{ version: 1, name: '  ', up: noop }])).toThrow(
      '数据库迁移名称不能为空：v1'
    )
  })
})

function columnNames(db: Database.Database, tableName: string): string[] {
  return (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map(
    (column) => column.name
  )
}

function tableNames(db: Database.Database): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{
      name: string
    }>
  ).map(({ name }) => name)
}

function createBareTestDatabase(): Database.Database {
  const db = createTestDatabase()
  db.exec(`
    DROP TABLE ai_report_sources;
    DROP TABLE ai_reports;
    DROP TABLE ai_disclosure_consents;
    DROP TABLE job_runs;
    DROP TABLE llm_profiles;
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
