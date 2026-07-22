import type { Database } from 'better-sqlite3'
import { getDatabase } from '../database'
import type { JobRun, JobRunKind, JobRunStatus } from '../../types/llm'

export class JobRunRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  create(job: JobRun): void {
    this.db
      .prepare(
        `INSERT INTO job_runs (
          id, kind, profile_id, status, stage, progress_current, progress_total,
          input_summary_json, error_code, safe_message, retry_of_job_id,
          created_at, started_at, finished_at
        ) VALUES (
          @id, @kind, @profileId, @status, @stage, @progressCurrent, @progressTotal,
          @inputSummaryJson, @errorCode, @safeMessage, @retryOfJobId,
          @createdAt, @startedAt, @finishedAt
        )`
      )
      .run(toParameters(job))
  }

  findById(id: string): JobRun | null {
    const row = this.db.prepare('SELECT * FROM job_runs WHERE id = ?').get(id) as
      JobRunRow | undefined
    return row ? fromRow(row) : null
  }

  findRecent(limit = 50): JobRun[] {
    return (
      this.db
        .prepare('SELECT * FROM job_runs ORDER BY created_at DESC, id DESC LIMIT ?')
        .all(limit) as JobRunRow[]
    ).map(fromRow)
  }

  markRunning(id: string, stage: string, startedAt: string): boolean {
    return this.updateWhereStatus(
      `UPDATE job_runs
       SET status = 'running', stage = ?, started_at = ?, finished_at = NULL,
           error_code = NULL, safe_message = NULL
       WHERE id = ? AND status = 'pending'`,
      [stage, startedAt, id]
    )
  }

  updateProgress(id: string, stage: string, current: number, total: number): boolean {
    return this.updateWhereStatus(
      `UPDATE job_runs
       SET stage = ?, progress_current = ?, progress_total = ?
       WHERE id = ? AND status = 'running'`,
      [stage, current, total, id]
    )
  }

  markSucceeded(id: string, finishedAt: string): boolean {
    return this.updateWhereStatus(
      `UPDATE job_runs
       SET status = 'succeeded', stage = 'completed', finished_at = ?,
           error_code = NULL, safe_message = NULL
       WHERE id = ? AND status = 'running'`,
      [finishedAt, id]
    )
  }

  markFailed(id: string, errorCode: string, safeMessage: string, finishedAt: string): boolean {
    return this.updateWhereStatus(
      `UPDATE job_runs
       SET status = 'failed', stage = 'failed', error_code = ?, safe_message = ?, finished_at = ?
       WHERE id = ? AND status IN ('pending', 'running')`,
      [errorCode, safeMessage, finishedAt, id]
    )
  }

  markCancelled(id: string, finishedAt: string): boolean {
    return this.updateWhereStatus(
      `UPDATE job_runs
       SET status = 'cancelled', stage = 'cancelled', finished_at = ?,
           error_code = 'LLM_CANCELLED', safe_message = '任务已取消'
       WHERE id = ? AND status IN ('pending', 'running')`,
      [finishedAt, id]
    )
  }

  interruptRunning(finishedAt: string): number {
    return this.db
      .prepare(
        `UPDATE job_runs
         SET status = 'interrupted', stage = 'interrupted', finished_at = ?,
             error_code = 'JOB_INTERRUPTED', safe_message = '应用退出前任务未完成'
         WHERE status = 'running'`
      )
      .run(finishedAt).changes
  }

  private updateWhereStatus(sql: string, parameters: Array<string | number>): boolean {
    return this.db.prepare(sql).run(...parameters).changes === 1
  }
}

interface JobRunRow {
  id: string
  kind: JobRunKind
  profile_id: string | null
  status: JobRunStatus
  stage: string
  progress_current: number | null
  progress_total: number | null
  input_summary_json: string
  error_code: string | null
  safe_message: string | null
  retry_of_job_id: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

function fromRow(row: JobRunRow): JobRun {
  return {
    id: row.id,
    kind: row.kind,
    profileId: row.profile_id ?? undefined,
    status: row.status,
    stage: row.stage,
    progressCurrent: row.progress_current ?? undefined,
    progressTotal: row.progress_total ?? undefined,
    inputSummary: JSON.parse(row.input_summary_json) as Record<string, unknown>,
    errorCode: row.error_code ?? undefined,
    safeMessage: row.safe_message ?? undefined,
    retryOfJobId: row.retry_of_job_id ?? undefined,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined
  }
}

function toParameters(job: JobRun): Record<string, string | number | null> {
  return {
    id: job.id,
    kind: job.kind,
    profileId: job.profileId ?? null,
    status: job.status,
    stage: job.stage,
    progressCurrent: job.progressCurrent ?? null,
    progressTotal: job.progressTotal ?? null,
    inputSummaryJson: JSON.stringify(job.inputSummary),
    errorCode: job.errorCode ?? null,
    safeMessage: job.safeMessage ?? null,
    retryOfJobId: job.retryOfJobId ?? null,
    createdAt: job.createdAt,
    startedAt: job.startedAt ?? null,
    finishedAt: job.finishedAt ?? null
  }
}
