import type { Database } from 'better-sqlite3'
import { getDatabase } from '../database'
import type { ExportRecord } from '../../types/export'

export class ExportRecordRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM export_records').get() as {
      count: number
    }
    return row.count
  }

  create(record: ExportRecord): void {
    this.db
      .prepare(
        `INSERT INTO export_records (
          id, export_type, file_path, song_count, source_type, source_id, source_name,
          scope, sort_mode, created_at
        )
        VALUES (
          @id, @exportType, @filePath, @songCount, @sourceType, @sourceId, @sourceName,
          @scope, @sortMode, @createdAt
        )`
      )
      .run({
        id: record.id,
        exportType: record.exportType,
        filePath: record.filePath,
        songCount: record.songCount,
        sourceType: record.sourceType ?? 'liked',
        sourceId: record.sourceId ?? null,
        sourceName: record.sourceName ?? '我喜欢的音乐',
        scope: record.scope ?? null,
        sortMode: record.sortMode ?? null,
        createdAt: record.createdAt
      })
  }

  findAll(): ExportRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM export_records ORDER BY created_at DESC')
      .all() as ExportRecordRow[]

    return rows.map(fromExportRecordRow)
  }

  findRecent(limit: number): ExportRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM export_records ORDER BY created_at DESC LIMIT ?')
      .all(limit) as ExportRecordRow[]

    return rows.map(fromExportRecordRow)
  }

  clearAll(): void {
    this.db.prepare('DELETE FROM export_records').run()
  }
}

interface ExportRecordRow {
  id: string
  export_type: ExportRecord['exportType']
  file_path: string
  song_count: number
  source_type: ExportRecord['sourceType'] | null
  source_id: string | null
  source_name: string | null
  scope: ExportRecord['scope'] | null
  sort_mode: ExportRecord['sortMode'] | null
  created_at: string
}

function fromExportRecordRow(row: ExportRecordRow): ExportRecord {
  return {
    id: row.id,
    exportType: row.export_type,
    filePath: row.file_path,
    songCount: row.song_count,
    sourceType: row.source_type ?? 'liked',
    sourceId: row.source_id ?? undefined,
    sourceName: row.source_name ?? '我喜欢的音乐',
    scope: row.scope ?? undefined,
    sortMode: row.sort_mode ?? undefined,
    createdAt: row.created_at
  }
}
