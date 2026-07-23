import { describe, expect, it } from 'vitest'
import { AI_REPORT_PROMPT_TEMPLATE_VERSION, type AIReportFactsV1 } from '../../types/aiReport'
import type { MusicAnalysisDataset } from '../../types/statistics'
import { buildAIReportPrompt } from './reportPrompt'

describe('AI report prompt', () => {
  it('exposes a fixed template version and only serializes the bounded analysis input', () => {
    const prompt = buildAIReportPrompt(datasetFixture(), factsFixture())

    expect(AI_REPORT_PROMPT_TEMPLATE_VERSION).toBe(2)
    expect(prompt.templateVersion).toBe(AI_REPORT_PROMPT_TEMPLATE_VERSION)
    expect(prompt.user).toContain(`sha256:${'a'.repeat(64)}`)
    expect(prompt.user).toContain('song-1')
    expect(prompt.user).not.toContain('nickname')
    expect(prompt.user).not.toContain('rawData')
    expect(prompt.system).toContain('这是收藏样本，不是完整播放历史')
  })
})

function datasetFixture(): MusicAnalysisDataset {
  const generatedAt = '2026-01-01T00:00:00.000Z'
  return {
    schemaVersion: 1,
    source: { type: 'liked', name: '我喜欢的音乐', timeField: 'likedAt' },
    scope: {
      selection: 'most_recent',
      requestedSongLimit: 100,
      availableSongCount: 1,
      includedSongCount: 1,
      truncated: false,
      timePrecision: 'source_timestamp'
    },
    summary: {
      source: { type: 'liked', name: '我喜欢的音乐', timeField: 'likedAt' },
      overview: { songCount: 1, uniqueSongCount: 1, artistCount: 1, albumCount: 1 },
      topArtists: [],
      topAlbums: [],
      timeDistribution: { byYear: [], byMonth: [] },
      recentSongs: [],
      earliestSongs: [],
      generatedAt
    },
    compactSongs: [
      {
        ncmSongId: 'song-1',
        name: 'Song',
        artists: ['Artist'],
        album: 'Album',
        time: 1_700_000_000_000,
        orderIndex: 0
      }
    ],
    digest: `sha256:${'a'.repeat(64)}`,
    generatedAt
  }
}

function factsFixture(): AIReportFactsV1 {
  return {
    schemaVersion: 1,
    sample: {
      songCount: 1,
      requestedSongLimit: 100,
      availableSongCount: 1,
      selection: 'most_recent',
      timePrecision: 'source_timestamp'
    },
    artists: { uniqueCount: 1, topShare: 1, singleAppearanceShare: 1, top: [] },
    albums: { uniqueCount: 1, top: [] },
    collaborations: { songShare: 0 },
    collection: { timestampCoverage: 1 }
  }
}
