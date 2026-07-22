import { afterEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDatabase } from '../db/testing/createTestDatabase'
import { JobRunRepository } from '../db/repositories/JobRunRepository'
import { JobManager } from './JobManager'

describe('JobManager', () => {
  const databases: Database.Database[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('records progress and completes a running job', async () => {
    const { manager, repository } = createManager(databases)
    const job = manager.createJob('ai_report_generation', {
      inputSummary: { sourceType: 'liked', songCount: 100, fieldsHash: 'sha256:fields' }
    })

    const result = await manager.run(job.id, async ({ updateProgress }) => {
      expect(updateProgress('requesting', 1, 2)).toBe(true)
      return 'report-id'
    })

    expect(result).toBe('report-id')
    expect(repository.findById(job.id)).toMatchObject({
      status: 'succeeded',
      stage: 'completed',
      progressCurrent: 1,
      progressTotal: 2
    })
  })

  it('keeps a cancelled job cancelled when its operation resolves later', async () => {
    const { manager, repository } = createManager(databases)
    const job = manager.createJob('llm_connection_test', {
      inputSummary: { sendsMusicData: false }
    })
    let resolveOperation: (() => void) | undefined
    const operation = new Promise<void>((resolve) => {
      resolveOperation = resolve
    })
    const running = manager.run(job.id, async ({ signal }) => {
      expect(signal.aborted).toBe(false)
      await operation
    })

    expect(manager.cancel(job.id)).toBe(true)
    resolveOperation?.()
    await expect(running).rejects.toMatchObject({ code: 'LLM_CANCELLED' })
    expect(repository.findById(job.id)).toMatchObject({ status: 'cancelled' })
  })

  it('stores only a generic message for unknown failures and supports retry', async () => {
    const { manager, repository } = createManager(databases)
    const job = manager.createJob('ai_report_generation', {
      inputSummary: { sourceType: 'liked', songCount: 25 }
    })

    await expect(
      manager.run(job.id, async () => {
        throw new Error('raw upstream error containing sk-secret-value')
      })
    ).rejects.toMatchObject({ code: 'JOB_FAILED', safeMessage: '任务执行失败，请稍后重试' })
    expect(JSON.stringify(repository.findById(job.id))).not.toContain('sk-secret-value')

    const retry = manager.retry(job.id)
    expect(retry).toMatchObject({ status: 'pending', retryOfJobId: job.id })
  })

  it('recovers unfinished jobs and rejects raw prompts in persisted summaries', () => {
    const { manager, repository } = createManager(databases)
    const pendingJob = manager.createJob('llm_connection_test', {
      inputSummary: { sendsMusicData: false }
    })
    const runningJob = manager.createJob('llm_connection_test', {
      inputSummary: { sendsMusicData: false }
    })
    expect(repository.markRunning(runningJob.id, 'requesting', '2026-01-01T00:00:09.000Z')).toBe(
      true
    )
    expect(manager.recoverInterruptedJobs()).toBe(2)
    expect(repository.findById(pendingJob.id)).toMatchObject({ status: 'interrupted' })
    expect(repository.findById(runningJob.id)).toMatchObject({ status: 'interrupted' })

    expect(() =>
      manager.createJob('ai_report_generation', {
        inputSummary: { prompt: 'do not persist this' }
      })
    ).toThrowError(expect.objectContaining({ code: 'JOB_INPUT_INVALID' }))
  })
})

function createManager(databases: Database.Database[]): {
  manager: JobManager
  repository: JobRunRepository
} {
  const db = createTestDatabase()
  databases.push(db)
  const repository = new JobRunRepository(db)
  let id = 0
  let tick = 0
  return {
    manager: new JobManager(
      repository,
      () => `job-${++id}`,
      () => `2026-01-01T00:00:${String(tick++).padStart(2, '0')}.000Z`
    ),
    repository
  }
}
