import { describe, expect, it } from 'vitest'
import type { MusicAnalysisDataset } from '../../types/statistics'
import { AIReportValidationError, parseAndValidateAIReport } from './reportValidation'

const dataset = {
  schemaVersion: 1,
  source: { type: 'liked', name: '我喜欢的音乐', timeField: 'likedAt' },
  scope: {
    selection: 'most_recent',
    requestedSongLimit: 100,
    availableSongCount: 2,
    includedSongCount: 2,
    truncated: false,
    timePrecision: 'source_timestamp'
  },
  summary: {
    source: { type: 'liked', name: '我喜欢的音乐', timeField: 'likedAt' },
    overview: { songCount: 2, uniqueSongCount: 2, artistCount: 1, albumCount: 1 },
    topArtists: [],
    topAlbums: [],
    timeDistribution: { byYear: [], byMonth: [] },
    recentSongs: [],
    earliestSongs: [],
    generatedAt: '2026-01-01T00:00:00.000Z'
  },
  compactSongs: [
    { ncmSongId: 'song-1', name: 'One', artists: ['Artist'] },
    { ncmSongId: 'song-2', name: 'Two', artists: ['Artist'] }
  ],
  digest: `sha256:${'a'.repeat(64)}`,
  generatedAt: '2026-01-01T00:00:00.000Z'
} satisfies MusicAnalysisDataset

describe('parseAndValidateAIReport', () => {
  it('accepts a bounded report and appends mandatory limitations', () => {
    const report = parseAndValidateAIReport(JSON.stringify(validReport()), dataset)

    expect(report.schemaVersion).toBe(1)
    expect(report.dimensions).toHaveLength(4)
    expect(report.limitations[0]).toContain('最近 2 首')
  })

  it('rejects evidence song IDs outside the dataset', () => {
    const value = validReport()
    value.listeningArchetype.evidence.songIds = ['unknown-song']

    expect(() => parseAndValidateAIReport(JSON.stringify(value), dataset)).toThrowError(
      expect.objectContaining<Partial<AIReportValidationError>>({
        message: expect.stringContaining('outside the dataset')
      })
    )
  })

  it('rejects high-confidence personality claims', () => {
    const value = validReport()
    value.personalityReflections[0].confidence = 'high'

    expect(() => parseAndValidateAIReport(JSON.stringify(value), dataset)).toThrowError(
      expect.objectContaining<Partial<AIReportValidationError>>({
        message: expect.stringContaining('cannot be high')
      })
    )
  })

  it('requires every explanatory item to cite at least one bounded evidence reference', () => {
    const value = validReport()
    value.moodsAndScenes[0].evidence = { songIds: [], factKeys: [] }

    expect(() => parseAndValidateAIReport(JSON.stringify(value), dataset)).toThrowError(
      expect.objectContaining<Partial<AIReportValidationError>>({
        message: expect.stringContaining('must reference at least one')
      })
    )
  })

  it('rejects unknown top-level and nested fields instead of persisting provider extras', () => {
    const topLevel = { ...validReport(), rawResponse: 'must not persist' }
    expect(() => parseAndValidateAIReport(JSON.stringify(topLevel), dataset)).toThrowError(
      expect.objectContaining<Partial<AIReportValidationError>>({
        message: expect.stringContaining('report.rawResponse is not allowed')
      })
    )

    const nested = validReport()
    Object.assign(nested.listeningArchetype.evidence, { explanation: 'unsupported' })
    expect(() => parseAndValidateAIReport(JSON.stringify(nested), dataset)).toThrowError(
      expect.objectContaining<Partial<AIReportValidationError>>({
        message: expect.stringContaining('evidence.explanation is not allowed')
      })
    )
  })
})

function validReport() {
  const evidence = { songIds: ['song-1'], factKeys: ['sample.songCount'] }
  const insight = {
    title: '观察',
    description: '这是一条保持克制、只用于测试结构的音乐偏好观察。',
    confidence: 'medium' as 'low' | 'medium' | 'high',
    evidence
  }
  return {
    schemaVersion: 1,
    title: '测试音乐画像',
    subtitle: '基于最近收藏样本的娱乐性回顾',
    tasteSnapshot: {
      summary: '样本表现出一定集中度，同时仍保留变化。',
      keywords: ['集中', '变化'],
      evidence
    },
    listeningArchetype: {
      name: '谨慎漫游者',
      description: '在熟悉与探索之间保持平衡。',
      confidence: 'medium',
      evidence
    },
    dimensions: [
      { ...insight, key: 'exploration_familiarity', tendency: '略偏熟悉' },
      { ...insight, key: 'focus_variety', tendency: '相对均衡' },
      { ...insight, key: 'collection_rhythm', tendency: '阶段性收藏' },
      { ...insight, key: 'emotional_texture', tendency: '多层次' }
    ],
    moodsAndScenes: [{ ...insight }],
    notablePatterns: [{ ...insight, confidence: 'high' }],
    personalityReflections: [{ ...insight }],
    limitations: ['这只是测试样本。', '缺少音频特征。']
  }
}
