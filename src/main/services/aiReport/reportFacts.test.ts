import { describe, expect, it } from 'vitest'
import type { MusicAnalysisDataset } from '../../types/statistics'
import { buildAIReportFacts } from './reportFacts'

describe('buildAIReportFacts', () => {
  it('derives deterministic facts from only the included songs', () => {
    const dataset = {
      schemaVersion: 1,
      source: { type: 'liked', name: '我喜欢的音乐', timeField: 'likedAt' },
      scope: {
        selection: 'most_recent',
        requestedSongLimit: 100,
        availableSongCount: 500,
        includedSongCount: 3,
        truncated: true,
        timePrecision: 'source_timestamp'
      },
      summary: {
        source: { type: 'liked', name: '我喜欢的音乐', timeField: 'likedAt' },
        overview: { songCount: 3, uniqueSongCount: 3, artistCount: 3, albumCount: 2 },
        topArtists: [
          { name: 'A', count: 2, percentage: 66.7, sampleSongs: [] },
          { name: 'B', count: 1, percentage: 33.3, sampleSongs: [] }
        ],
        topAlbums: [
          { name: 'Album', artistNames: ['A'], count: 2, percentage: 66.7, sampleSongs: [] }
        ],
        timeDistribution: { byYear: [], byMonth: [] },
        recentSongs: [],
        earliestSongs: [],
        generatedAt: '2026-01-01T00:00:00.000Z'
      },
      compactSongs: [
        { ncmSongId: '1', name: 'One', artists: ['A'], album: 'Album', time: 300 },
        { ncmSongId: '2', name: 'Two', artists: ['A', 'B'], album: 'Album', time: 200 },
        { ncmSongId: '3', name: 'Three', artists: ['C'], album: 'Other', time: 100 }
      ],
      digest: `sha256:${'a'.repeat(64)}`,
      generatedAt: '2026-01-01T00:00:00.000Z'
    } satisfies MusicAnalysisDataset

    expect(buildAIReportFacts(dataset)).toMatchObject({
      sample: { songCount: 3, availableSongCount: 500 },
      artists: { uniqueCount: 3, topShare: 66.7, singleAppearanceShare: 66.7 },
      albums: { uniqueCount: 2 },
      collaborations: { songShare: 33.3 },
      collection: { timestampCoverage: 100 }
    })
  })
})
