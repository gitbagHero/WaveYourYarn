import type {
  AIReportConfidence,
  AIReportContentV1,
  AIReportDimension,
  AIReportDimensionKey,
  AIReportEvidence,
  AIReportInsight
} from '../../types/aiReport'
import type { MusicAnalysisDataset } from '../../types/statistics'
import { AI_REPORT_FACT_KEYS } from './reportFacts'

const DIMENSION_KEYS = new Set<AIReportDimensionKey>([
  'exploration_familiarity',
  'focus_variety',
  'collection_rhythm',
  'emotional_texture'
])
const CONFIDENCE_VALUES = new Set<AIReportConfidence>(['low', 'medium', 'high'])
const REPORT_KEYS = [
  'schemaVersion',
  'title',
  'subtitle',
  'tasteSnapshot',
  'listeningArchetype',
  'dimensions',
  'moodsAndScenes',
  'notablePatterns',
  'personalityReflections',
  'limitations'
] as const

export class AIReportValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AIReportValidationError'
  }
}

export function parseAndValidateAIReport(
  rawContent: string,
  dataset: MusicAnalysisDataset
): AIReportContentV1 {
  const parsed = parseJsonObject(rawContent)
  const allowedSongIds = new Set(dataset.compactSongs.map((song) => song.ncmSongId))
  const allowedFactKeys = new Set<string>(AI_REPORT_FACT_KEYS)

  if (parsed.schemaVersion !== 1) {
    throw new AIReportValidationError('Report schemaVersion must be 1.')
  }

  const dimensions = readArray(parsed.dimensions, 'dimensions', 4, 4).map((value, index) =>
    readDimension(value, `dimensions[${index}]`, allowedSongIds, allowedFactKeys)
  )
  if (new Set(dimensions.map((dimension) => dimension.key)).size !== 4) {
    throw new AIReportValidationError('Report dimensions must contain four unique keys.')
  }

  const report: AIReportContentV1 = {
    schemaVersion: 1,
    title: readString(parsed.title, 'title', 1, 60),
    subtitle: readString(parsed.subtitle, 'subtitle', 1, 120),
    tasteSnapshot: readTasteSnapshot(parsed.tasteSnapshot, allowedSongIds, allowedFactKeys),
    listeningArchetype: readArchetype(parsed.listeningArchetype, allowedSongIds, allowedFactKeys),
    dimensions,
    moodsAndScenes: readInsights(
      parsed.moodsAndScenes,
      'moodsAndScenes',
      1,
      4,
      allowedSongIds,
      allowedFactKeys,
      false
    ),
    notablePatterns: readInsights(
      parsed.notablePatterns,
      'notablePatterns',
      1,
      4,
      allowedSongIds,
      allowedFactKeys,
      true
    ),
    personalityReflections: readInsights(
      parsed.personalityReflections,
      'personalityReflections',
      1,
      3,
      allowedSongIds,
      allowedFactKeys,
      false
    ),
    limitations: readArray(parsed.limitations, 'limitations', 2, 10).map((value, index) =>
      readString(value, `limitations[${index}]`, 1, 300)
    )
  }

  report.limitations = [
    `本报告只基于最近 ${dataset.scope.includedSongCount} 首收藏样本，不代表完整播放历史。`,
    '当前数据不含流派、发行日期、热度、歌词和音频特征，因此相关情绪与场景描述仅为低置信度解释。',
    '音乐偏好画像仅供娱乐和自我回顾，不能作为心理测评、人格诊断或事实判断。',
    ...report.limitations
  ].slice(0, 10)

  return report
}

function parseJsonObject(rawContent: string): Record<string, unknown> {
  const trimmed = rawContent.trim()
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim()

  try {
    const parsed: unknown = JSON.parse(withoutFence)
    return readObject(parsed, 'report', REPORT_KEYS)
  } catch (error) {
    if (error instanceof AIReportValidationError) {
      throw error
    }
    throw new AIReportValidationError('Provider did not return valid JSON.')
  }
}

function readTasteSnapshot(
  value: unknown,
  allowedSongIds: Set<string>,
  allowedFactKeys: Set<string>
): AIReportContentV1['tasteSnapshot'] {
  const object = readObject(value, 'tasteSnapshot', ['summary', 'keywords', 'evidence'])
  return {
    summary: readString(object.summary, 'tasteSnapshot.summary', 1, 800),
    keywords: readArray(object.keywords, 'tasteSnapshot.keywords', 2, 8).map((keyword, index) =>
      readString(keyword, `tasteSnapshot.keywords[${index}]`, 1, 40)
    ),
    evidence: readEvidence(
      object.evidence,
      'tasteSnapshot.evidence',
      allowedSongIds,
      allowedFactKeys
    )
  }
}

function readArchetype(
  value: unknown,
  allowedSongIds: Set<string>,
  allowedFactKeys: Set<string>
): AIReportContentV1['listeningArchetype'] {
  const object = readObject(value, 'listeningArchetype', [
    'name',
    'description',
    'confidence',
    'evidence'
  ])
  return {
    name: readString(object.name, 'listeningArchetype.name', 1, 60),
    description: readString(object.description, 'listeningArchetype.description', 1, 800),
    confidence: readConfidence(object.confidence, 'listeningArchetype.confidence', false),
    evidence: readEvidence(
      object.evidence,
      'listeningArchetype.evidence',
      allowedSongIds,
      allowedFactKeys
    )
  }
}

function readDimension(
  value: unknown,
  path: string,
  allowedSongIds: Set<string>,
  allowedFactKeys: Set<string>
): AIReportDimension {
  const object = readObject(value, path, [
    'key',
    'title',
    'tendency',
    'description',
    'confidence',
    'evidence'
  ])
  const key = readString(object.key, `${path}.key`, 1, 80)

  if (!DIMENSION_KEYS.has(key as AIReportDimensionKey)) {
    throw new AIReportValidationError(`${path}.key is unsupported.`)
  }

  return {
    key: key as AIReportDimensionKey,
    title: readString(object.title, `${path}.title`, 1, 80),
    tendency: readString(object.tendency, `${path}.tendency`, 1, 100),
    description: readString(object.description, `${path}.description`, 1, 800),
    confidence: readConfidence(object.confidence, `${path}.confidence`, false),
    evidence: readEvidence(object.evidence, `${path}.evidence`, allowedSongIds, allowedFactKeys)
  }
}

function readInsights(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  allowedSongIds: Set<string>,
  allowedFactKeys: Set<string>,
  allowHighConfidence: boolean
): AIReportInsight[] {
  return readArray(value, path, minimum, maximum).map((entry, index) => {
    const itemPath = `${path}[${index}]`
    const object = readObject(entry, itemPath, ['title', 'description', 'confidence', 'evidence'])
    return {
      title: readString(object.title, `${itemPath}.title`, 1, 100),
      description: readString(object.description, `${itemPath}.description`, 1, 800),
      confidence: readConfidence(object.confidence, `${itemPath}.confidence`, allowHighConfidence),
      evidence: readEvidence(
        object.evidence,
        `${itemPath}.evidence`,
        allowedSongIds,
        allowedFactKeys
      )
    }
  })
}

function readEvidence(
  value: unknown,
  path: string,
  allowedSongIds: Set<string>,
  allowedFactKeys: Set<string>
): AIReportEvidence {
  const object = readObject(value, path, ['songIds', 'factKeys'])
  const songIds = readArray(object.songIds, `${path}.songIds`, 0, 8).map((songId, index) =>
    readString(songId, `${path}.songIds[${index}]`, 1, 100)
  )
  const factKeys = readArray(object.factKeys, `${path}.factKeys`, 0, 8).map((factKey, index) =>
    readString(factKey, `${path}.factKeys[${index}]`, 1, 100)
  )

  if (songIds.some((songId) => !allowedSongIds.has(songId))) {
    throw new AIReportValidationError(`${path}.songIds contains an ID outside the dataset.`)
  }
  if (factKeys.some((factKey) => !allowedFactKeys.has(factKey))) {
    throw new AIReportValidationError(`${path}.factKeys contains an unsupported fact key.`)
  }
  if (songIds.length === 0 && factKeys.length === 0) {
    throw new AIReportValidationError(`${path} must reference at least one song ID or fact key.`)
  }

  return { songIds: [...new Set(songIds)], factKeys: [...new Set(factKeys)] }
}

function readConfidence(
  value: unknown,
  path: string,
  allowHighConfidence: boolean
): AIReportConfidence {
  if (typeof value !== 'string' || !CONFIDENCE_VALUES.has(value as AIReportConfidence)) {
    throw new AIReportValidationError(`${path} must be a confidence value.`)
  }
  if (!allowHighConfidence && value === 'high') {
    throw new AIReportValidationError(`${path} cannot be high for an interpretive section.`)
  }
  return value as AIReportConfidence
}

function readObject(
  value: unknown,
  path: string,
  allowedKeys?: readonly string[]
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AIReportValidationError(`${path} must be an object.`)
  }
  const object = value as Record<string, unknown>
  if (allowedKeys) {
    const allowed = new Set(allowedKeys)
    const unknownKey = Object.keys(object).find((key) => !allowed.has(key))
    if (unknownKey) {
      throw new AIReportValidationError(`${path}.${unknownKey} is not allowed.`)
    }
  }
  return object
}

function readArray(value: unknown, path: string, minimum: number, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new AIReportValidationError(`${path} must contain ${minimum}-${maximum} items.`)
  }
  return value
}

function readString(
  value: unknown,
  path: string,
  minimumLength: number,
  maximumLength: number
): string {
  if (typeof value !== 'string') {
    throw new AIReportValidationError(`${path} must be a string.`)
  }
  const normalized = value.trim()
  if (normalized.length < minimumLength || normalized.length > maximumLength) {
    throw new AIReportValidationError(
      `${path} length must be between ${minimumLength} and ${maximumLength}.`
    )
  }
  return normalized
}
