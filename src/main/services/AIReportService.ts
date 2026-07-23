import type {
  AIReportDetail,
  AIReportRecord,
  AIReportSourceRecord,
  AIReportSummary
} from '../types/aiReport'
import { nowIso } from '../utils/time'

export class AIReportServiceError extends Error {
  constructor(
    readonly code: 'AI_REPORT_NOT_FOUND',
    message: string
  ) {
    super(message)
    this.name = 'AIReportServiceError'
  }
}

export interface AIReportStore {
  findAll(): AIReportRecord[]
  findById(id: string): AIReportRecord | null
  findByJobId(jobId: string): AIReportRecord | null
  rename(id: string, userTitle: string, updatedAt: string): boolean
  softDelete(id: string, deletedAt: string): boolean
}

export interface AIReportSourceStore {
  findByReportId(reportId: string): AIReportSourceRecord[]
}

export class AIReportService {
  constructor(
    private readonly reports: AIReportStore,
    private readonly sources: AIReportSourceStore,
    private readonly clock: () => string = nowIso
  ) {}

  list(): AIReportSummary[] {
    return this.reports.findAll().map(toSummary)
  }

  get(id: string): AIReportDetail {
    return this.toDetail(this.requireReport(this.reports.findById(id)))
  }

  getByJobId(jobId: string): AIReportDetail {
    return this.toDetail(this.requireReport(this.reports.findByJobId(jobId)))
  }

  rename(id: string, userTitle: string): AIReportDetail {
    if (!this.reports.rename(id, userTitle, this.clock())) {
      throw notFound()
    }
    return this.get(id)
  }

  delete(id: string): boolean {
    if (!this.reports.softDelete(id, this.clock())) {
      throw notFound()
    }
    return true
  }

  private requireReport(report: AIReportRecord | null): AIReportRecord {
    if (!report) {
      throw notFound()
    }
    return report
  }

  private toDetail(report: AIReportRecord): AIReportDetail {
    return {
      report,
      sources: this.sources.findByReportId(report.id)
    }
  }
}

function toSummary(report: AIReportRecord): AIReportSummary {
  return {
    id: report.id,
    jobId: report.jobId,
    profileId: report.profileId,
    userTitle: report.userTitle,
    subtitle: report.content.subtitle,
    keywords: [...report.content.tasteSnapshot.keywords],
    providerOrigin: report.providerOrigin,
    modelId: report.modelId,
    promptTemplateVersion: report.promptTemplateVersion,
    datasetDigest: report.datasetDigest,
    generatedAt: report.generatedAt,
    updatedAt: report.updatedAt
  }
}

function notFound(): AIReportServiceError {
  return new AIReportServiceError('AI_REPORT_NOT_FOUND', 'AI 报告不存在或已删除')
}
