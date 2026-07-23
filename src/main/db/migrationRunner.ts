import type { Database } from 'better-sqlite3'
import { nowIso } from '../utils/time'
import { createInitialSchema, ensureColumn } from './schema'

export interface DatabaseMigration {
  version: number
  name: string
  up: (db: Database) => void
}

/**
 * The authoritative database migration registry.
 *
 * Published migrations are append-only. Do not recreate a second registry in
 * SQL files or mutate an existing version after it has shipped.
 */
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
  },
  {
    version: 7,
    name: 'llm profiles jobs and disclosure consents',
    up: (db) => {
      db.exec(`
        CREATE TABLE llm_profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
          protocol TEXT NOT NULL CHECK (length(trim(protocol)) > 0),
          base_url TEXT NOT NULL CHECK (length(trim(base_url)) > 0),
          model_id TEXT NOT NULL CHECK (length(trim(model_id)) > 0),
          timeout_ms INTEGER NOT NULL CHECK (timeout_ms BETWEEN 1000 AND 900000),
          output_mode TEXT NOT NULL CHECK (
            output_mode IN ('json_schema', 'json_object', 'prompt_json')
          ),
          language TEXT NOT NULL DEFAULT 'zh-CN' CHECK (length(trim(language)) > 0),
          max_input_songs INTEGER NOT NULL DEFAULT 100 CHECK (
            max_input_songs BETWEEN 1 AND 100
          ),
          secret_ref TEXT NOT NULL UNIQUE CHECK (length(trim(secret_ref)) > 0),
          is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
          last_tested_at TEXT,
          last_test_status TEXT CHECK (
            last_test_status IS NULL OR last_test_status IN ('succeeded', 'failed')
          ),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE UNIQUE INDEX idx_llm_profiles_single_active
          ON llm_profiles (is_active)
          WHERE is_active = 1;
        CREATE INDEX idx_llm_profiles_updated
          ON llm_profiles (updated_at DESC);

        CREATE TABLE job_runs (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK (length(trim(kind)) > 0),
          profile_id TEXT REFERENCES llm_profiles(id) ON DELETE SET NULL,
          status TEXT NOT NULL CHECK (
            status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled', 'interrupted')
          ),
          stage TEXT NOT NULL CHECK (length(trim(stage)) > 0),
          progress_current INTEGER,
          progress_total INTEGER,
          input_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(input_summary_json)),
          error_code TEXT,
          safe_message TEXT,
          retry_of_job_id TEXT REFERENCES job_runs(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT,
          CHECK (
            (progress_current IS NULL AND progress_total IS NULL)
            OR (
              progress_current IS NOT NULL
              AND progress_total IS NOT NULL
              AND progress_current >= 0
              AND progress_total >= 0
              AND progress_current <= progress_total
            )
          )
        );

        CREATE INDEX idx_job_runs_status_created
          ON job_runs (status, created_at DESC);
        CREATE INDEX idx_job_runs_profile_created
          ON job_runs (profile_id, created_at DESC);
        CREATE INDEX idx_job_runs_retry
          ON job_runs (retry_of_job_id);

        CREATE TABLE ai_disclosure_consents (
          id TEXT PRIMARY KEY,
          profile_id TEXT NOT NULL REFERENCES llm_profiles(id) ON DELETE CASCADE,
          target_origin TEXT NOT NULL CHECK (length(trim(target_origin)) > 0),
          protocol TEXT NOT NULL CHECK (length(trim(protocol)) > 0),
          source_type TEXT NOT NULL CHECK (source_type IN ('liked', 'playlist', 'all')),
          source_id TEXT,
          fields_hash TEXT NOT NULL CHECK (length(trim(fields_hash)) > 0),
          max_input_songs INTEGER NOT NULL CHECK (max_input_songs BETWEEN 1 AND 100),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (
            (source_type = 'playlist' AND source_id IS NOT NULL AND length(trim(source_id)) > 0)
            OR (source_type IN ('liked', 'all') AND source_id IS NULL)
          )
        );

        CREATE UNIQUE INDEX idx_ai_disclosure_consents_scope
          ON ai_disclosure_consents (
            profile_id,
            target_origin,
            protocol,
            source_type,
            ifnull(source_id, ''),
            fields_hash,
            max_input_songs
          );
        CREATE INDEX idx_ai_disclosure_consents_profile_updated
          ON ai_disclosure_consents (profile_id, updated_at DESC);
      `)
    }
  },
  {
    version: 8,
    name: 'ai reports and source snapshots',
    up: (db) => {
      db.exec(`
        CREATE TABLE ai_reports (
          id TEXT PRIMARY KEY,
          job_id TEXT UNIQUE REFERENCES job_runs(id) ON DELETE SET NULL,
          profile_id TEXT REFERENCES llm_profiles(id) ON DELETE SET NULL,
          user_title TEXT NOT NULL CHECK (length(trim(user_title)) BETWEEN 1 AND 120),
          status TEXT NOT NULL CHECK (status = 'succeeded'),
          content_schema_version INTEGER NOT NULL CHECK (content_schema_version = 1),
          protocol TEXT NOT NULL CHECK (length(trim(protocol)) > 0),
          provider_origin TEXT NOT NULL CHECK (length(trim(provider_origin)) > 0),
          model_id TEXT NOT NULL CHECK (length(trim(model_id)) > 0),
          prompt_template_version INTEGER NOT NULL CHECK (prompt_template_version > 0),
          dataset_digest TEXT NOT NULL CHECK (length(trim(dataset_digest)) > 0),
          content_json TEXT NOT NULL CHECK (
            json_valid(content_json)
            AND json_type(content_json) = 'object'
            AND json_type(content_json, '$.schemaVersion') = 'integer'
            AND json_extract(content_json, '$.schemaVersion') = content_schema_version
          ),
          generated_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );

        CREATE INDEX idx_ai_reports_active_generated
          ON ai_reports (generated_at DESC, id DESC)
          WHERE deleted_at IS NULL;
        CREATE INDEX idx_ai_reports_dataset_digest
          ON ai_reports (dataset_digest);
        CREATE INDEX idx_ai_reports_profile_generated
          ON ai_reports (profile_id, generated_at DESC);

        CREATE TRIGGER trg_ai_reports_require_successful_job
          BEFORE INSERT ON ai_reports
          WHEN NEW.job_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM job_runs
            WHERE id = NEW.job_id
              AND kind = 'ai_report_generation'
              AND status = 'succeeded'
              AND profile_id = NEW.profile_id
          )
          BEGIN
            SELECT RAISE(ABORT, 'AI report requires a matching successful generation job');
          END;

        CREATE TABLE ai_report_sources (
          id TEXT PRIMARY KEY,
          report_id TEXT NOT NULL REFERENCES ai_reports(id) ON DELETE CASCADE,
          source_type TEXT NOT NULL CHECK (source_type IN ('liked', 'playlist', 'all')),
          source_id TEXT,
          source_name TEXT NOT NULL CHECK (length(trim(source_name)) > 0),
          dataset_schema_version INTEGER NOT NULL CHECK (dataset_schema_version = 1),
          selection TEXT NOT NULL CHECK (selection = 'most_recent'),
          requested_song_limit INTEGER NOT NULL CHECK (requested_song_limit BETWEEN 1 AND 100),
          available_song_count INTEGER NOT NULL CHECK (available_song_count >= 0),
          included_song_count INTEGER NOT NULL CHECK (
            included_song_count BETWEEN 1 AND requested_song_limit
            AND included_song_count <= available_song_count
          ),
          truncated INTEGER NOT NULL CHECK (truncated IN (0, 1)),
          time_precision TEXT NOT NULL CHECK (
            time_precision IN ('source_timestamp', 'mixed', 'order_only', 'none')
          ),
          song_ids_json TEXT NOT NULL CHECK (
            json_valid(song_ids_json)
            AND json_type(song_ids_json) = 'array'
            AND json_array_length(song_ids_json) = included_song_count
          ),
          summary_json TEXT NOT NULL CHECK (
            json_valid(summary_json) AND json_type(summary_json) = 'object'
          ),
          dataset_digest TEXT NOT NULL CHECK (length(trim(dataset_digest)) > 0),
          generated_at TEXT NOT NULL,
          CHECK (
            (source_type = 'playlist' AND source_id IS NOT NULL AND length(trim(source_id)) > 0)
            OR (source_type IN ('liked', 'all') AND source_id IS NULL)
          )
        );

        CREATE INDEX idx_ai_report_sources_report
          ON ai_report_sources (report_id, generated_at DESC, id ASC);
        CREATE INDEX idx_ai_report_sources_digest
          ON ai_report_sources (dataset_digest);

        CREATE TRIGGER trg_ai_report_sources_match_digest
          BEFORE INSERT ON ai_report_sources
          WHEN NOT EXISTS (
            SELECT 1 FROM ai_reports
            WHERE id = NEW.report_id AND dataset_digest = NEW.dataset_digest
          )
          BEGIN
            SELECT RAISE(ABORT, 'AI report source digest does not match its report');
          END;
      `)
    }
  }
]

export const CURRENT_DATABASE_SCHEMA_VERSION = Math.max(
  ...DATABASE_MIGRATIONS.map((migration) => migration.version)
)

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

    if (!migration.name.trim()) {
      throw new Error(`数据库迁移名称不能为空：v${migration.version}`)
    }

    versions.add(migration.version)
  }

  const orderedVersions = [...versions].sort((a, b) => a - b)
  for (const [index, version] of orderedVersions.entries()) {
    const expectedVersion = index + 1
    if (version !== expectedVersion) {
      throw new Error(`数据库迁移版本不连续：期望 v${expectedVersion}，实际 v${version}`)
    }
  }
}
