import { nanoid } from 'nanoid'
import { JobRunRepository } from '../db/repositories/JobRunRepository'
import { JOB_RUN_KINDS, type JobRun, type JobRunKind } from '../types/llm'
import { nowIso } from '../utils/time'
import { LLMProviderError } from '../adapters/llm/LLMProvider'

const MAX_INPUT_SUMMARY_CHARACTERS = 4_096
const MAX_SUMMARY_DEPTH = 4
const MAX_SAFE_MESSAGE_CHARACTERS = 240
const FORBIDDEN_SUMMARY_KEYS = new Set([
  'apikey',
  'authorization',
  'messages',
  'prompt',
  'rawrequest',
  'rawresponse',
  'secret',
  'songs',
  'token',
  'tracks'
])

export interface CreateJobInput {
  profileId?: string
  inputSummary: Record<string, unknown>
  retryOfJobId?: string
}

export interface RetryJobInput {
  expectedKind?: JobRunKind
  profileId?: string
  inputSummary?: Record<string, unknown>
}

export interface JobOperationContext {
  signal: AbortSignal
  updateProgress(stage: string, current: number, total: number): boolean
}

export type JobExecutionErrorCode =
  | 'JOB_INVALID_STATE'
  | 'JOB_NOT_FOUND'
  | 'JOB_INPUT_INVALID'
  | 'JOB_FAILED'
  | 'LLM_CANCELLED'
  | string

export class JobExecutionError extends Error {
  constructor(
    readonly code: JobExecutionErrorCode,
    readonly safeMessage: string
  ) {
    super(safeMessage)
    this.name = 'JobExecutionError'
  }
}

export class JobManager {
  private readonly controllers = new Map<string, AbortController>()

  constructor(
    private readonly repository = new JobRunRepository(),
    private readonly createId: () => string = nanoid,
    private readonly clock: () => string = nowIso
  ) {}

  recoverInterruptedJobs(): number {
    return this.repository.interruptUnfinished(this.clock())
  }

  createJob(kind: JobRunKind, input: CreateJobInput): JobRun {
    if (!JOB_RUN_KINDS.includes(kind)) {
      throw new JobExecutionError('JOB_INPUT_INVALID', '不支持的任务类型')
    }

    const job: JobRun = {
      id: this.createId(),
      kind,
      profileId: normalizeOptionalId(input.profileId),
      status: 'pending',
      stage: 'queued',
      inputSummary: normalizeInputSummary(input.inputSummary),
      retryOfJobId: normalizeOptionalId(input.retryOfJobId),
      createdAt: this.clock()
    }
    this.repository.create(job)
    return job
  }

  async run<Result>(
    id: string,
    operation: (context: JobOperationContext) => Promise<Result>,
    persistSuccess?: (result: Result, finishedAt: string) => void
  ): Promise<Result> {
    if (!this.repository.findById(id)) {
      throw new JobExecutionError('JOB_NOT_FOUND', '任务不存在')
    }
    if (!this.repository.markRunning(id, 'starting', this.clock())) {
      throw new JobExecutionError('JOB_INVALID_STATE', '任务当前状态不允许启动')
    }

    const controller = new AbortController()
    this.controllers.set(id, controller)

    try {
      const result = await operation({
        signal: controller.signal,
        updateProgress: (stage, current, total) =>
          this.updateProgress(id, stage, current, total, controller)
      })

      const finishedAt = this.clock()
      const succeeded = persistSuccess
        ? this.repository.markSucceededAtomically(id, finishedAt, () =>
            persistSuccess(result, finishedAt)
          )
        : this.repository.markSucceeded(id, finishedAt)
      if (!succeeded) {
        throw this.currentStateError(id)
      }
      return result
    } catch (error) {
      const current = this.repository.findById(id)
      if (
        current?.status === 'cancelled' ||
        controller.signal.aborted ||
        (error instanceof JobExecutionError && error.code === 'LLM_CANCELLED') ||
        (error instanceof LLMProviderError && error.code === 'LLM_CANCELLED')
      ) {
        if (current?.status === 'running') {
          this.repository.markCancelled(id, this.clock())
        }
        throw new JobExecutionError('LLM_CANCELLED', '任务已取消')
      }

      const safeError = toSafeError(error)
      if (!this.repository.markFailed(id, safeError.code, safeError.safeMessage, this.clock())) {
        throw this.currentStateError(id)
      }
      throw safeError
    } finally {
      this.controllers.delete(id)
    }
  }

  cancel(id: string): boolean {
    const cancelled = this.repository.markCancelled(id, this.clock())
    if (cancelled) {
      this.controllers.get(id)?.abort()
    }
    return cancelled
  }

  retry(id: string, input: RetryJobInput = {}): JobRun {
    const original = this.repository.findById(id)
    if (!original) {
      throw new JobExecutionError('JOB_NOT_FOUND', '任务不存在')
    }
    if (!['failed', 'cancelled', 'interrupted'].includes(original.status)) {
      throw new JobExecutionError('JOB_INVALID_STATE', '只有失败、取消或中断的任务可以重试')
    }
    if (input.expectedKind && original.kind !== input.expectedKind) {
      throw new JobExecutionError('JOB_INPUT_INVALID', '原任务类型与重试操作不匹配')
    }

    return this.createJob(original.kind, {
      profileId: input.profileId ?? original.profileId,
      inputSummary: input.inputSummary ?? original.inputSummary,
      retryOfJobId: original.id
    })
  }

  private updateProgress(
    id: string,
    rawStage: string,
    current: number,
    total: number,
    controller: AbortController
  ): boolean {
    const stage = normalizeStage(rawStage)
    if (
      !Number.isInteger(current) ||
      !Number.isInteger(total) ||
      current < 0 ||
      total < 0 ||
      current > total
    ) {
      throw new JobExecutionError('JOB_INPUT_INVALID', '任务进度数据无效')
    }

    const updated = this.repository.updateProgress(id, stage, current, total)
    if (!updated && this.repository.findById(id)?.status === 'cancelled') {
      controller.abort()
    }
    return updated
  }

  private currentStateError(id: string): JobExecutionError {
    const current = this.repository.findById(id)
    if (!current) {
      return new JobExecutionError('JOB_NOT_FOUND', '任务不存在')
    }
    if (current.status === 'cancelled') {
      return new JobExecutionError('LLM_CANCELLED', '任务已取消')
    }
    return new JobExecutionError('JOB_INVALID_STATE', '任务状态已发生变化')
  }
}

function toSafeError(error: unknown): JobExecutionError {
  if (error instanceof JobExecutionError) {
    return new JobExecutionError(error.code, normalizeSafeMessage(error.safeMessage))
  }
  if (error instanceof LLMProviderError) {
    return new JobExecutionError(error.code, normalizeSafeMessage(error.message))
  }
  return new JobExecutionError('JOB_FAILED', '任务执行失败，请稍后重试')
}

function normalizeSafeMessage(value: string): string {
  const message = value.trim()
  return message && message.length <= MAX_SAFE_MESSAGE_CHARACTERS
    ? message
    : '任务执行失败，请稍后重试'
}

function normalizeInputSummary(summary: Record<string, unknown>): Record<string, unknown> {
  validateSummaryValue(summary, 0)

  let serialized: string
  try {
    serialized = JSON.stringify(summary)
  } catch {
    throw new JobExecutionError('JOB_INPUT_INVALID', '任务摘要必须可以序列化')
  }
  if (serialized.length > MAX_INPUT_SUMMARY_CHARACTERS) {
    throw new JobExecutionError('JOB_INPUT_INVALID', '任务摘要超过安全长度限制')
  }
  return JSON.parse(serialized) as Record<string, unknown>
}

function validateSummaryValue(value: unknown, depth: number): void {
  if (depth > MAX_SUMMARY_DEPTH) {
    throw new JobExecutionError('JOB_INPUT_INVALID', '任务摘要嵌套层级过深')
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return
  }
  if (typeof value === 'string') {
    if (value.length > 500) {
      throw new JobExecutionError('JOB_INPUT_INVALID', '任务摘要字段超过安全长度限制')
    }
    return
  }
  if (Array.isArray(value)) {
    if (value.length > 100) {
      throw new JobExecutionError('JOB_INPUT_INVALID', '任务摘要数组超过安全长度限制')
    }
    value.forEach((item) => validateSummaryValue(item, depth + 1))
    return
  }
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new JobExecutionError('JOB_INPUT_INVALID', '任务摘要包含不支持的数据类型')
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase()
    if (FORBIDDEN_SUMMARY_KEYS.has(normalizedKey)) {
      throw new JobExecutionError('JOB_INPUT_INVALID', '任务摘要不能包含原始请求或敏感数据')
    }
    validateSummaryValue(nestedValue, depth + 1)
  }
}

function normalizeStage(value: string): string {
  const stage = value.trim()
  if (!stage || stage.length > 80) {
    throw new JobExecutionError('JOB_INPUT_INVALID', '任务阶段名称无效')
  }
  return stage
}

function normalizeOptionalId(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }
  const id = value.trim()
  if (!id || id.length > 200) {
    throw new JobExecutionError('JOB_INPUT_INVALID', '任务关联 ID 无效')
  }
  return id
}
