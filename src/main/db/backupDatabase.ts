import Database from 'better-sqlite3'
import { closeDatabase, getDatabase } from './database'
import { CURRENT_DATABASE_SCHEMA_VERSION, runDatabaseMigrations } from './migrationRunner'
import type { BackupDataCounts } from '../types/backup'

export interface BackupDatabaseSummary {
  schemaVersion: number
  counts: BackupDataCounts
}

export interface BackupDatabaseGateway {
  createSanitizedSnapshot(destinationPath: string): Promise<BackupDatabaseSummary>
  createEmergencySnapshot(destinationPath: string): Promise<void>
  inspectSnapshot(snapshotPath: string): BackupDatabaseSummary
  prepareRestoreSnapshot(snapshotPath: string): BackupDatabaseSummary
  closeActiveDatabase(): void
}

const BASE_REQUIRED_TABLES = [
  'users',
  'songs',
  'playlists',
  'playlist_songs',
  'export_records',
  'app_settings',
  'schema_migrations'
]
const SCHEMA_7_REQUIRED_TABLES = ['llm_profiles', 'job_runs', 'ai_disclosure_consents']
const SCHEMA_8_REQUIRED_TABLES = ['ai_reports', 'ai_report_sources']
export class SQLiteBackupDatabaseGateway implements BackupDatabaseGateway {
  async createSanitizedSnapshot(destinationPath: string): Promise<BackupDatabaseSummary> {
    await getDatabase().backup(destinationPath)
    const snapshot = new Database(destinationPath)

    try {
      removeSecrets(snapshot)
    } finally {
      snapshot.close()
    }

    return this.inspectSnapshot(destinationPath)
  }

  async createEmergencySnapshot(destinationPath: string): Promise<void> {
    await getDatabase().backup(destinationPath)
  }

  inspectSnapshot(snapshotPath: string): BackupDatabaseSummary {
    const snapshot = new Database(snapshotPath, { readonly: true, fileMustExist: true })

    try {
      assertDatabaseIntegrity(snapshot)
      assertRequiredTables(snapshot, ['schema_migrations'])
      const schemaVersion = getSchemaVersion(snapshot)

      assertSupportedBackupSchema(schemaVersion)
      assertRequiredTables(snapshot, requiredTablesForSchema(schemaVersion))

      assertRelations(snapshot)
      return {
        schemaVersion,
        counts: getDatabaseCounts(snapshot)
      }
    } finally {
      snapshot.close()
    }
  }

  prepareRestoreSnapshot(snapshotPath: string): BackupDatabaseSummary {
    const snapshot = new Database(snapshotPath, { fileMustExist: true })

    try {
      assertDatabaseIntegrity(snapshot)
      assertRequiredTables(snapshot, ['schema_migrations'])
      const schemaVersion = getSchemaVersion(snapshot)

      assertSupportedBackupSchema(schemaVersion)
      assertRequiredTables(snapshot, requiredTablesForSchema(schemaVersion))

      runDatabaseMigrations(snapshot)
      removeSecrets(snapshot)
      assertDatabaseIntegrity(snapshot)
      assertRelations(snapshot)
      return {
        schemaVersion: getSchemaVersion(snapshot),
        counts: getDatabaseCounts(snapshot)
      }
    } finally {
      snapshot.close()
    }
  }

  closeActiveDatabase(): void {
    closeDatabase()
  }
}

export function assertSupportedBackupSchema(
  schemaVersion: number,
  currentSchemaVersion = CURRENT_DATABASE_SCHEMA_VERSION
): void {
  if (schemaVersion > currentSchemaVersion) {
    throw new Error(`备份数据库版本 ${schemaVersion} 高于当前支持版本 ${currentSchemaVersion}`)
  }
}

function removeSecrets(db: Database.Database): void {
  db.pragma('secure_delete = ON')
  db.prepare("DELETE FROM app_settings WHERE key LIKE 'secret:%'").run()
  db.exec('VACUUM')
}

function assertDatabaseIntegrity(db: Database.Database): void {
  const rows = db.pragma('integrity_check') as Array<Record<string, unknown>>
  const messages = rows.flatMap((row) => Object.values(row).map(String))

  if (messages.length !== 1 || messages[0].toLowerCase() !== 'ok') {
    throw new Error(`SQLite 完整性检查失败：${messages.join('; ') || 'unknown'}`)
  }
}

function assertRequiredTables(db: Database.Database, requiredTables: string[]): void {
  const tableRows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>
  const tables = new Set(tableRows.map((row) => row.name))
  const missing = requiredTables.filter((table) => !tables.has(table))

  if (missing.length > 0) {
    throw new Error(`备份数据库缺少必要数据表：${missing.join(', ')}`)
  }
}

function requiredTablesForSchema(schemaVersion: number): string[] {
  if (schemaVersion >= 8) {
    return [...BASE_REQUIRED_TABLES, ...SCHEMA_7_REQUIRED_TABLES, ...SCHEMA_8_REQUIRED_TABLES]
  }
  if (schemaVersion >= 7) {
    return [...BASE_REQUIRED_TABLES, ...SCHEMA_7_REQUIRED_TABLES]
  }
  return BASE_REQUIRED_TABLES
}

function assertRelations(db: Database.Database): void {
  const orphaned = db
    .prepare(
      `SELECT COUNT(*) as count
       FROM playlist_songs
       LEFT JOIN playlists ON playlists.id = playlist_songs.playlist_id
       LEFT JOIN songs ON songs.id = playlist_songs.song_id
       WHERE playlists.id IS NULL OR songs.id IS NULL`
    )
    .get() as { count: number }

  if (orphaned.count > 0) {
    throw new Error(`备份数据库包含 ${orphaned.count} 条孤立歌单歌曲关系`)
  }

  if (hasTable(db, 'ai_report_sources')) {
    const orphanedReportSources = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM ai_report_sources
         LEFT JOIN ai_reports ON ai_reports.id = ai_report_sources.report_id
         WHERE ai_reports.id IS NULL`
      )
      .get() as { count: number }

    if (orphanedReportSources.count > 0) {
      throw new Error(`备份数据库包含 ${orphanedReportSources.count} 条孤立报告数据源`)
    }
  }
}

function hasTable(db: Database.Database, tableName: string): boolean {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName)
  )
}

function getSchemaVersion(db: Database.Database): number {
  const row = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as {
    version: number | null
  }
  return row.version ?? 0
}

function getDatabaseCounts(db: Database.Database): BackupDataCounts {
  return {
    users: countRows(db, 'users'),
    songs: countRows(db, 'songs'),
    playlists: countRows(db, 'playlists'),
    playlistSongs: countRows(db, 'playlist_songs'),
    exportRecords: countRows(db, 'export_records'),
    publicSettings: countPublicSettings(db)
  }
}

function countRows(db: Database.Database, tableName: string): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number }
  return row.count
}

function countPublicSettings(db: Database.Database): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM app_settings WHERE key NOT LIKE 'secret:%'")
    .get() as { count: number }
  return row.count
}
