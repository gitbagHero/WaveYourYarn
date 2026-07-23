import type { AIDisclosureSourceRequest, LLMProtocol } from './llm'
import type { AnalysisTimePrecision, MusicStatsSummary, StatisticsSourceType } from './statistics'

export type AIReportConfidence = 'low' | 'medium' | 'high'

export const AI_REPORT_CONTENT_SCHEMA_VERSION = 1 as const
export const AI_REPORT_PROMPT_TEMPLATE_VERSION = 3 as const
export const AI_REPORT_STATUSES = ['succeeded'] as const
export type AIReportStatus = (typeof AI_REPORT_STATUSES)[number]

export type AIReportDimensionKey =
  'exploration_familiarity' | 'focus_variety' | 'collection_rhythm' | 'emotional_texture'

export interface AIReportEvidence {
  songIds: string[]
  factKeys: string[]
}

export interface AIReportInsight {
  title: string
  description: string
  confidence: AIReportConfidence
  evidence: AIReportEvidence
}

export interface AIReportDimension extends AIReportInsight {
  key: AIReportDimensionKey
  tendency: string
}

export interface AIReportContentV1 {
  schemaVersion: typeof AI_REPORT_CONTENT_SCHEMA_VERSION
  title: string
  subtitle: string
  tasteSnapshot: {
    summary: string
    keywords: string[]
    /** Required by prompt template v3; absent only on locally stored pre-v3 reports. */
    evidence?: AIReportEvidence
  }
  listeningArchetype: {
    name: string
    description: string
    confidence: AIReportConfidence
    evidence: AIReportEvidence
  }
  dimensions: AIReportDimension[]
  moodsAndScenes: AIReportInsight[]
  notablePatterns: AIReportInsight[]
  personalityReflections: AIReportInsight[]
  limitations: string[]
}

export interface AIReportFactsV1 {
  schemaVersion: typeof AI_REPORT_CONTENT_SCHEMA_VERSION
  sample: {
    songCount: number
    requestedSongLimit: number
    availableSongCount: number
    selection: 'most_recent'
    timePrecision: 'source_timestamp' | 'mixed' | 'order_only' | 'none'
  }
  artists: {
    uniqueCount: number
    topShare: number
    singleAppearanceShare: number
    top: Array<{ name: string; count: number; percentage: number }>
  }
  albums: {
    uniqueCount: number
    top: Array<{ name: string; artistNames: string[]; count: number; percentage: number }>
  }
  collaborations: {
    songShare: number
  }
  collection: {
    timestampCoverage: number
    spanDays?: number
    earliestTime?: number
    latestTime?: number
  }
}

/**
 * Immutable audit snapshot for one successfully generated report.
 * Provider responses and API keys must never be stored in this record.
 */
export interface AIReportRecord {
  id: string
  jobId?: string
  profileId?: string
  userTitle: string
  status: AIReportStatus
  contentSchemaVersion: typeof AI_REPORT_CONTENT_SCHEMA_VERSION
  protocol: LLMProtocol
  providerOrigin: string
  modelId: string
  promptTemplateVersion: number
  datasetDigest: string
  content: AIReportContentV1
  generatedAt: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export type NewAIReportRecord = Omit<AIReportRecord, 'jobId' | 'profileId' | 'deletedAt'> & {
  jobId: string
  profileId: string
}

export interface StartAIReportGenerationRequest {
  profileId: string
  source: AIDisclosureSourceRequest
  authorizationToken: string
  requestedSongLimit?: number
  language?: string
  retryOfJobId?: string
}

/**
 * Local source snapshot used to explain and reproduce a report. Song IDs are
 * copied as data and deliberately have no foreign key to the mutable cache.
 */
export interface AIReportSourceRecord {
  id: string
  reportId: string
  sourceType: StatisticsSourceType
  sourceId?: string
  sourceName: string
  datasetSchemaVersion: 1
  selection: 'most_recent'
  requestedSongLimit: number
  availableSongCount: number
  includedSongCount: number
  truncated: boolean
  timePrecision: AnalysisTimePrecision
  songIds: string[]
  summary: MusicStatsSummary
  datasetDigest: string
  generatedAt: string
}

export interface AIReportSummary {
  id: string
  jobId?: string
  profileId?: string
  userTitle: string
  subtitle: string
  keywords: string[]
  providerOrigin: string
  modelId: string
  promptTemplateVersion: number
  datasetDigest: string
  generatedAt: string
  updatedAt: string
}

export interface AIReportDetail {
  report: AIReportRecord
  sources: AIReportSourceRecord[]
}

export interface AIReportIdRequest {
  id: string
}

export interface AIReportJobIdRequest {
  jobId: string
}

export interface RenameAIReportRequest extends AIReportIdRequest {
  userTitle: string
}
