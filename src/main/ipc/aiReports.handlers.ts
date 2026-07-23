import type {
  AIReportDetail,
  AIReportSummary,
  StartAIReportGenerationRequest
} from '../types/aiReport'
import type { JobRun } from '../types/llm'
import { toLLMIpcResult } from './llmIpcResult'
import {
  parseAIReportIdRequest,
  parseAIReportJobIdRequest,
  parseRenameAIReportRequest,
  parseStartAIReportGenerationRequest
} from './llmValidators'

export interface AIReportReaderWriter {
  list(): AIReportSummary[]
  get(id: string): AIReportDetail
  getByJobId(jobId: string): AIReportDetail
  rename(id: string, userTitle: string): AIReportDetail
  delete(id: string): boolean
}

export interface AIReportGenerator {
  start(request: StartAIReportGenerationRequest): Promise<JobRun>
}

export class AIReportsIpcHandlers {
  constructor(
    private readonly reports: AIReportReaderWriter,
    private readonly generation: AIReportGenerator
  ) {}

  list() {
    return toLLMIpcResult(() => this.reports.list())
  }

  get(payload: unknown) {
    return toLLMIpcResult(() => this.reports.get(parseAIReportIdRequest(payload).id))
  }

  getByJob(payload: unknown) {
    return toLLMIpcResult(() => this.reports.getByJobId(parseAIReportJobIdRequest(payload).jobId))
  }

  start(payload: unknown) {
    return toLLMIpcResult(() => this.generation.start(parseStartAIReportGenerationRequest(payload)))
  }

  rename(payload: unknown) {
    return toLLMIpcResult(() => {
      const request = parseRenameAIReportRequest(payload)
      return this.reports.rename(request.id, request.userTitle)
    })
  }

  delete(payload: unknown) {
    return toLLMIpcResult(() => this.reports.delete(parseAIReportIdRequest(payload).id))
  }
}
