import { describe, expect, it } from 'vitest'
import type { LikedSong, PlaylistTrack } from '../../types/song'
import {
  buildOverview,
  buildTimeDistribution,
  buildTopAlbums,
  buildTopArtists,
  dedupeSongs,
  getSongTime,
  sampleAnalysisSongs
} from './statisticsCalculations'

describe('statistics calculations', () => {
  it('deduplicates all-source songs using the newest known timestamp', () => {
    const older = likedSong('same-song', 'Older copy', 1, 1_000)
    const newer = playlistSong('same-song', 'Newer copy', 3, 2_000)

    const result = dedupeSongs([older, newer], 'all')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ name: 'Newer copy', orderIndex: 1 })
    expect(getSongTime(result[0], 'all')).toBe(2_000)
  })

  it('builds deterministic aggregate statistics without exposing raw song data', () => {
    const songs = [
      likedSong('1', 'First', 0, Date.UTC(2024, 0, 15), ['Artist A'], 'Album A'),
      likedSong('2', 'Second', 1, Date.UTC(2025, 1, 15), ['Artist A', 'Artist B'], 'Album A')
    ]

    expect(buildOverview(songs, songs, 'liked')).toMatchObject({
      songCount: 2,
      uniqueSongCount: 2,
      artistCount: 2,
      albumCount: 1,
      timeCoverageLabel: '2024-01 至 2025-02'
    })
    expect(buildTopArtists(songs)[0]).toMatchObject({ name: 'Artist A', count: 2, percentage: 100 })
    expect(buildTopAlbums(songs)[0]).toMatchObject({ name: 'Album A', count: 2, percentage: 100 })
    expect(buildTimeDistribution(songs, 'liked')).toEqual({
      byYear: [
        { year: '2024', count: 1 },
        { year: '2025', count: 1 }
      ],
      byMonth: [
        { month: '2024-01', count: 1 },
        { month: '2025-02', count: 1 }
      ]
    })
  })

  it('caps analysis samples at 300 newest songs', () => {
    const songs = Array.from({ length: 305 }, (_, index) =>
      likedSong(String(index), `Song ${index}`, index, index + 1)
    )

    const sample = sampleAnalysisSongs(songs, 'liked')

    expect(sample).toHaveLength(300)
    expect(sample[0].name).toBe('Song 304')
    expect(sample.at(-1)?.name).toBe('Song 5')
  })
})

function likedSong(
  id: string,
  name: string,
  orderIndex: number,
  likedAt: number,
  artists = ['Artist'],
  album = 'Album'
): LikedSong {
  return {
    id: `liked-${id}`,
    ncmSongId: id,
    name,
    artists,
    album,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    orderIndex,
    likedAt
  }
}

function playlistSong(
  id: string,
  name: string,
  orderIndex: number,
  addedAt: number
): PlaylistTrack {
  return {
    id: `playlist-${id}`,
    ncmSongId: id,
    playlistId: 'playlist-1',
    name,
    artists: ['Artist'],
    album: 'Album',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    orderIndex,
    addedAt
  }
}
