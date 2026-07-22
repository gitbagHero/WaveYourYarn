import { describe, expect, it } from 'vitest'
import type { MusicAnalysisScope, StatisticsSourceInfo } from '../../types/statistics'
import { createAnalysisDatasetDigest } from './analysisDataset'

const source: StatisticsSourceInfo = {
  type: 'liked',
  name: '我喜欢的音乐',
  timeField: 'likedAt'
}

const scope: MusicAnalysisScope = {
  selection: 'most_recent',
  requestedSongLimit: 100,
  availableSongCount: 2,
  includedSongCount: 2,
  truncated: false,
  timePrecision: 'source_timestamp'
}

describe('analysis dataset digest', () => {
  it('is stable for the same ordered source snapshot', () => {
    const input = {
      schemaVersion: 1 as const,
      source,
      scope,
      compactSongs: [
        {
          ncmSongId: '1',
          name: 'First',
          artists: ['Artist'],
          album: 'Album',
          time: 2,
          orderIndex: 0
        },
        {
          ncmSongId: '2',
          name: 'Second',
          artists: ['Artist'],
          time: 1,
          orderIndex: 1
        }
      ]
    }

    expect(createAnalysisDatasetDigest(input)).toBe(createAnalysisDatasetDigest(input))
    expect(createAnalysisDatasetDigest(input)).toMatch(/^sha256:[a-f0-9]{64}$/u)
  })

  it('changes when song order or identity changes', () => {
    const first = {
      schemaVersion: 1 as const,
      source,
      scope,
      compactSongs: [
        { ncmSongId: '1', name: 'First', artists: ['Artist'], orderIndex: 0 },
        { ncmSongId: '2', name: 'Second', artists: ['Artist'], orderIndex: 1 }
      ]
    }
    const reversed = {
      ...first,
      compactSongs: [...first.compactSongs].reverse()
    }

    expect(createAnalysisDatasetDigest(first)).not.toBe(createAnalysisDatasetDigest(reversed))
  })
})
