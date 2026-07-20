import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import packageJson from '../../../package.json'
import { getDatabase } from '../db/database'
import type {
  DiagnosticDatabaseCounts,
  DiagnosticExportResult,
  DiagnosticRuntimeInfo,
  DiagnosticSummary
} from '../types/diagnostics'
import { getLogFilePath, readRecentRedactedLogs } from '../utils/logger'
import { redactSensitiveData } from '../utils/redaction'
import { nowIso } from '../utils/time'

export interface DiagnosticServicePaths {
  appDataDirectory: string
  databasePath: string
}

export class DiagnosticService {
  constructor(
    private readonly db: Database = getDatabase(),
    private readonly paths: DiagnosticServicePaths,
    private readonly readLogs: (maxLines?: number) => Promise<string[]> = readRecentRedactedLogs
  ) {}

  async getSummary(runtime: DiagnosticRuntimeInfo): Promise<DiagnosticSummary> {
    const [appDataDirectoryAvailable, databaseFileAvailable, logFileAvailable, databaseSize] =
      await Promise.all([
        pathIsAvailable(this.paths.appDataDirectory),
        pathIsAvailable(this.paths.databasePath),
        pathIsAvailable(getLogFilePath()),
        getFileSize(this.paths.databasePath)
      ])

    return {
      generatedAt: nowIso(),
      application: {
        version: runtime.appVersion,
        electronVersion: runtime.electronVersion,
        chromiumVersion: runtime.chromiumVersion,
        nodeVersion: runtime.nodeVersion,
        platform: runtime.platform,
        architecture: runtime.architecture,
        locale: runtime.locale
      },
      database: {
        schemaVersion: getSchemaVersion(this.db),
        sizeBytes: databaseSize,
        integrity: getIntegrityStatus(this.db),
        counts: getDiagnosticCounts(this.db)
      },
      storage: {
        appDataDirectoryAvailable,
        databaseFileAvailable,
        logFileAvailable,
        safeStorageAvailable: runtime.safeStorageAvailable
      },
      adapters: {
        netease: {
          packageName: '@neteasecloudmusicapienhanced/api',
          version: packageJson.dependencies['@neteasecloudmusicapienhanced/api'].replace(/^[~^]/, '')
        },
        llm: { status: 'not-configured' },
        appleMusic: { status: 'not-configured' }
      }
    }
  }

  async exportDiagnostics(
    destinationPath: string,
    runtime: DiagnosticRuntimeInfo
  ): Promise<DiagnosticExportResult> {
    const summary = await this.getSummary(runtime)
    const logs = await this.readLogs(500)
    const payload = redactSensitiveData({
      format: 'waveyouryarn-diagnostics',
      formatVersion: 1,
      summary,
      logs
    })
    const temporaryPath = `${destinationPath}.tmp-${randomUUID()}`

    try {
      await writeFile(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx'
      })
      await rm(destinationPath, { force: true })
      await rename(temporaryPath, destinationPath)
      return {
        fileName: basename(destinationPath),
        generatedAt: summary.generatedAt
      }
    } catch (error) {
      await rm(temporaryPath, { force: true })
      throw error
    }
  }
}

function getSchemaVersion(db: Database): number {
  const row = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as {
    version: number | null
  }
  return row.version ?? 0
}

function getIntegrityStatus(db: Database): 'ok' | 'failed' {
  const rows = db.prepare('PRAGMA quick_check').all() as Array<Record<string, unknown>>
  const messages = rows.flatMap((row) => Object.values(row).map(String))
  return messages.length === 1 && messages[0].toLowerCase() === 'ok' ? 'ok' : 'failed'
}

function getDiagnosticCounts(db: Database): DiagnosticDatabaseCounts {
  return {
    users: countRows(db, 'users'),
    songs: countRows(db, 'songs'),
    playlists: countRows(db, 'playlists'),
    playlistSongs: countRows(db, 'playlist_songs'),
    exportRecords: countRows(db, 'export_records'),
    publicSettings: countPublicSettings(db)
  }
}

function countRows(db: Database, tableName: string): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number }
  return row.count
}

function countPublicSettings(db: Database): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM app_settings WHERE key NOT LIKE 'secret:%'")
    .get() as { count: number }
  return row.count
}

async function pathIsAvailable(path: string | null): Promise<boolean> {
  if (!path) {
    return false
  }

  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function getFileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size
  } catch {
    return 0
  }
}
