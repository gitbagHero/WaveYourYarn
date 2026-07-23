import type { Database } from 'better-sqlite3'
import type {
  AIReportContentV1,
  AIReportRecord,
  AIReportStatus,
  NewAIReportRecord
} from '../../types/aiReport'
import type { LLMProtocol } from '../../types/llm'
import { getDatabase } from '../database'

export class AIReportRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  create(report: NewAIReportRecord): void {
    this.db
      .prepare(
        `INSERT INTO ai_reports (
          id, job_id, profile_id, user_title, status, content_schema_version,
          protocol, provider_origin, model_id, prompt_template_version,
          dataset_digest, content_json, generated_at, created_at, updated_at, deleted_at
        ) VALUES (
          @id, @jobId, @profileId, @userTitle, @status, @contentSchemaVersion,
          @protocol, @providerOrigin, @modelId, @promptTemplateVersion,
          @datasetDigest, @contentJson, @generatedAt, @createdAt, @updatedAt, @deletedAt
        )`
      )
      .run(toParameters(report))
  }

  count(includeDeleted = false): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count FROM ai_reports
         ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'}`
      )
      .get() as { count: number }
    return row.count
  }

  findById(id: string, includeDeleted = false): AIReportRecord | null {
    const row = this.db
      .prepare(
        `SELECT * FROM ai_reports
         WHERE id = ? ${includeDeleted ? '' : 'AND deleted_at IS NULL'}`
      )
      .get(id) as AIReportRow | undefined
    return row ? fromRow(row) : null
  }

  findByJobId(jobId: string, includeDeleted = false): AIReportRecord | null {
    const row = this.db
      .prepare(
        `SELECT * FROM ai_reports
         WHERE job_id = ? ${includeDeleted ? '' : 'AND deleted_at IS NULL'}`
      )
      .get(jobId) as AIReportRow | undefined
    return row ? fromRow(row) : null
  }

  findAll(includeDeleted = false): AIReportRecord[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM ai_reports
           ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'}
           ORDER BY generated_at DESC, id DESC`
        )
        .all() as AIReportRow[]
    ).map(fromRow)
  }

  rename(id: string, userTitle: string, updatedAt: string): boolean {
    return (
      this.db
        .prepare(
          `UPDATE ai_reports
           SET user_title = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .run(userTitle, updatedAt, id).changes === 1
    )
  }

  softDelete(id: string, deletedAt: string): boolean {
    return (
      this.db
        .prepare(
          `UPDATE ai_reports
           SET deleted_at = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .run(deletedAt, deletedAt, id).changes === 1
    )
  }
}

interface AIReportRow {
  id: string
  job_id: string | null
  profile_id: string | null
  user_title: string
  status: AIReportStatus
  content_schema_version: 1
  protocol: LLMProtocol
  provider_origin: string
  model_id: string
  prompt_template_version: number
  dataset_digest: string
  content_json: string
  generated_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function fromRow(row: AIReportRow): AIReportRecord {
  return {
    id: row.id,
    jobId: row.job_id ?? undefined,
    profileId: row.profile_id ?? undefined,
    userTitle: row.user_title,
    status: row.status,
    contentSchemaVersion: row.content_schema_version,
    protocol: row.protocol,
    providerOrigin: row.provider_origin,
    modelId: row.model_id,
    promptTemplateVersion: row.prompt_template_version,
    datasetDigest: row.dataset_digest,
    content: JSON.parse(row.content_json) as AIReportContentV1,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined
  }
}

function toParameters(report: NewAIReportRecord): Record<string, string | number | null> {
  return {
    id: report.id,
    jobId: report.jobId,
    profileId: report.profileId,
    userTitle: report.userTitle,
    status: report.status,
    contentSchemaVersion: report.contentSchemaVersion,
    protocol: report.protocol,
    providerOrigin: report.providerOrigin,
    modelId: report.modelId,
    promptTemplateVersion: report.promptTemplateVersion,
    datasetDigest: report.datasetDigest,
    contentJson: JSON.stringify(report.content),
    generatedAt: report.generatedAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    deletedAt: null
  }
}
