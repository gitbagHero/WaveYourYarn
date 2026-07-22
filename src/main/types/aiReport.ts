export type AIReportConfidence = 'low' | 'medium' | 'high'

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
  schemaVersion: 1
  title: string
  subtitle: string
  tasteSnapshot: {
    summary: string
    keywords: string[]
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
  schemaVersion: 1
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
