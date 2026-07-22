import { describe, expect, it } from 'vitest'
import type { StatisticsRepository } from '../db/repositories/StatisticsRepository'
import type { LikedSong } from '../types/song'
import { StatisticsService } from './StatisticsService'

describe('StatisticsService analysis dataset', () => {
  it('uses the same most-recent 100-song window for summary and LLM input', async () => {
    const songs = Array.from({ length: 105 }, (_, index) => likedSong(index))
    const repository = {
      getLikedSongsForStats: () => songs
    } as unknown as StatisticsRepository
    const service = new StatisticsService(repository)

    const dataset = await service.getAnalysisDataset({ type: 'liked' })

    expect(dataset.schemaVersion).toBe(1)
    expect(dataset.scope).toMatchObject({
      requestedSongLimit: 100,
      availableSongCount: 105,
      includedSongCount: 100,
      truncated: true,
      timePrecision: 'source_timestamp'
    })
    expect(dataset.summary.overview).toMatchObject({ songCount: 100, uniqueSongCount: 100 })
    expect(dataset.compactSongs).toHaveLength(100)
    expect(dataset.compactSongs[0].ncmSongId).toBe('song-104')
    expect(dataset.compactSongs.at(-1)?.ncmSongId).toBe('song-5')
    expect(dataset.digest).toMatch(/^sha256:[a-f0-9]{64}$/u)
  })

  it('applies a smaller profile limit consistently to the summary and compact input', async () => {
    const songs = Array.from({ length: 25 }, (_, index) => likedSong(index))
    const repository = {
      getLikedSongsForStats: () => songs
    } as unknown as StatisticsRepository
    const service = new StatisticsService(repository)

    const dataset = await service.getAnalysisDataset({ type: 'liked' }, 10)

    expect(dataset.scope).toMatchObject({
      requestedSongLimit: 10,
      availableSongCount: 25,
      includedSongCount: 10,
      truncated: true
    })
    expect(dataset.summary.overview.songCount).toBe(10)
    expect(dataset.compactSongs).toHaveLength(10)
    await expect(service.getAnalysisDataset({ type: 'liked' }, 101)).rejects.toThrow(
      '分析歌曲数必须为 1 至 100 之间的整数'
    )
  })
})

function likedSong(index: number): LikedSong {
  return {
    id: `local-${index}`,
    ncmSongId: `song-${index}`,
    name: `Song ${index}`,
    artists: [`Artist ${index % 10}`],
    album: `Album ${index % 20}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    orderIndex: 104 - index,
    likedAt: index + 1
  }
}
