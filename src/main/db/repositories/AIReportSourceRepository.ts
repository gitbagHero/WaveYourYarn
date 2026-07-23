import type { Database } from 'better-sqlite3'
import type { AIReportSourceRecord } from '../../types/aiReport'
import type {
  AnalysisTimePrecision,
  MusicStatsSummary,
  StatisticsSourceType
} from '../../types/statistics'
import { getDatabase } from '../database'

export class AIReportSourceRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  create(source: AIReportSourceRecord): void {
    this.db
      .prepare(
        `INSERT INTO ai_report_sources (
          id, report_id, source_type, source_id, source_name, dataset_schema_version,
          selection, requested_song_limit, available_song_count, included_song_count,
          truncated, time_precision, song_ids_json, summary_json, dataset_digest, generated_at
        ) VALUES (
          @id, @reportId, @sourceType, @sourceId, @sourceName, @datasetSchemaVersion,
          @selection, @requestedSongLimit, @availableSongCount, @includedSongCount,
          @truncated, @timePrecision, @songIdsJson, @summaryJson, @datasetDigest, @generatedAt
        )`
      )
      .run(toParameters(source))
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM ai_report_sources').get() as {
      count: number
    }
    return row.count
  }

  findById(id: string): AIReportSourceRecord | null {
    const row = this.db.prepare('SELECT * FROM ai_report_sources WHERE id = ?').get(id) as
      AIReportSourceRow | undefined
    return row ? fromRow(row) : null
  }

  findByReportId(reportId: string): AIReportSourceRecord[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM ai_report_sources
           WHERE report_id = ?
           ORDER BY generated_at DESC, id ASC`
        )
        .all(reportId) as AIReportSourceRow[]
    ).map(fromRow)
  }
}

interface AIReportSourceRow {
  id: string
  report_id: string
  source_type: StatisticsSourceType
  source_id: string | null
  source_name: string
  dataset_schema_version: 1
  selection: 'most_recent'
  requested_song_limit: number
  available_song_count: number
  included_song_count: number
  truncated: number
  time_precision: AnalysisTimePrecision
  song_ids_json: string
  summary_json: string
  dataset_digest: string
  generated_at: string
}

function fromRow(row: AIReportSourceRow): AIReportSourceRecord {
  return {
    id: row.id,
    reportId: row.report_id,
    sourceType: row.source_type,
    sourceId: row.source_id ?? undefined,
    sourceName: row.source_name,
    datasetSchemaVersion: row.dataset_schema_version,
    selection: row.selection,
    requestedSongLimit: row.requested_song_limit,
    availableSongCount: row.available_song_count,
    includedSongCount: row.included_song_count,
    truncated: row.truncated === 1,
    timePrecision: row.time_precision,
    songIds: JSON.parse(row.song_ids_json) as string[],
    summary: JSON.parse(row.summary_json) as MusicStatsSummary,
    datasetDigest: row.dataset_digest,
    generatedAt: row.generated_at
  }
}

function toParameters(source: AIReportSourceRecord): Record<string, string | number | null> {
  return {
    id: source.id,
    reportId: source.reportId,
    sourceType: source.sourceType,
    sourceId: source.sourceId ?? null,
    sourceName: source.sourceName,
    datasetSchemaVersion: source.datasetSchemaVersion,
    selection: source.selection,
    requestedSongLimit: source.requestedSongLimit,
    availableSongCount: source.availableSongCount,
    includedSongCount: source.includedSongCount,
    truncated: source.truncated ? 1 : 0,
    timePrecision: source.timePrecision,
    songIdsJson: JSON.stringify(source.songIds),
    summaryJson: JSON.stringify(source.summary),
    datasetDigest: source.datasetDigest,
    generatedAt: source.generatedAt
  }
}
