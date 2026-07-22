import type { JobRunRepository } from '../db/repositories/JobRunRepository'
import { JobExecutionError, type JobManager } from '../services/JobManager'
import type { LLMConnectionTestService } from '../services/LLMConnectionTestService'
import { toLLMIpcResult } from './llmIpcResult'
import { parseLLMJobIdRequest, parseLLMProfileIdRequest } from './llmValidators'

export class LLMJobsIpcHandlers {
  constructor(
    private readonly repository: JobRunRepository,
    private readonly manager: JobManager,
    private readonly connectionTests: LLMConnectionTestService
  ) {}

  list() {
    return toLLMIpcResult(() => this.repository.findRecent())
  }

  get(payload: unknown) {
    return toLLMIpcResult(() => {
      const job = this.repository.findById(parseLLMJobIdRequest(payload).id)
      if (!job) {
        throw new JobExecutionError('JOB_NOT_FOUND', '任务不存在')
      }
      return job
    })
  }

  cancel(payload: unknown) {
    return toLLMIpcResult(() => this.manager.cancel(parseLLMJobIdRequest(payload).id))
  }

  testConnection(payload: unknown) {
    return toLLMIpcResult(() => this.connectionTests.start(parseLLMProfileIdRequest(payload).id))
  }
}
