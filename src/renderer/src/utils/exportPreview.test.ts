import { describe, expect, it } from 'vitest'
import type { LikedSong, PlaylistTrack } from '../types/song'
import { getPreviewSongTime, sortPreviewSongs } from './exportPreview'

describe('export preview helpers', () => {
  const likedSongs: LikedSong[] = [
    song('1', 2, 1_000),
    song('2', 0, undefined),
    song('3', 1, 2_000)
  ]

  it('sorts by source time while leaving missing timestamps at the end', () => {
    expect(sortPreviewSongs(likedSongs, 'liked', 'timeDesc').map((song) => song.ncmSongId)).toEqual(
      ['3', '1', '2']
    )
    expect(sortPreviewSongs(likedSongs, 'liked', 'timeAsc').map((song) => song.ncmSongId)).toEqual([
      '1',
      '3',
      '2'
    ])
  })

  it('sorts by original order without mutating the input', () => {
    const result = sortPreviewSongs(likedSongs, 'liked', 'originalOrder')

    expect(result.map((song) => song.ncmSongId)).toEqual(['2', '3', '1'])
    expect(likedSongs.map((song) => song.ncmSongId)).toEqual(['1', '2', '3'])
  })

  it('reads only the timestamp that belongs to the selected source', () => {
    const playlistSong: PlaylistTrack = {
      ...song('4', 0, 5_000),
      playlistId: 'playlist-1',
      addedAt: 8_000
    }

    expect(getPreviewSongTime(playlistSong, 'liked')).toBe(5_000)
    expect(getPreviewSongTime(playlistSong, 'playlist')).toBe(8_000)
  })
})

function song(id: string, orderIndex: number, likedAt?: number): LikedSong {
  return {
    id,
    ncmSongId: id,
    name: `Song ${id}`,
    artists: ['Artist'],
    album: 'Album',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    orderIndex,
    likedAt
  }
}
