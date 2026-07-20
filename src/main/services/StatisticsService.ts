import { StatisticsRepository } from '../db/repositories/StatisticsRepository'
import type {
  MusicAnalysisDataset,
  MusicStatsSummary,
  PlaylistStatsOverview,
  StatisticsSource,
  StatisticsSourceInfo
} from '../types/statistics'
import { logger } from '../utils/logger'
import { nowIso } from '../utils/time'
import {
  buildOverview,
  buildTimeDistribution,
  buildTimeSongs,
  buildTopAlbums,
  buildTopArtists,
  dedupeSongs,
  normalizeSongsForStats,
  sampleAnalysisSongs,
  type StatSong
} from './statistics/statisticsCalculations'

interface ResolvedStatsSource {
  info: StatisticsSourceInfo
  songs: StatSong[]
  playlistOverview?: PlaylistStatsOverview
}

export class StatisticsService {
  constructor(private readonly statisticsRepository = new StatisticsRepository()) {}

  async getMusicStatsSummary(source: StatisticsSource): Promise<MusicStatsSummary> {
    const resolved = this.resolveStatsSource(source)
    const statsSongs = normalizeSongsForStats(resolved.songs, resolved.info.type)
    const uniqueSongs = dedupeSongs(statsSongs, resolved.info.type)

    logger.info('开始生成音乐统计', {
      sourceType: resolved.info.type,
      sourceName: resolved.info.name,
      songCount: statsSongs.length,
      uniqueSongCount: uniqueSongs.length
    })

    const overview = buildOverview(
      statsSongs,
      uniqueSongs,
      resolved.info.type,
      resolved.playlistOverview
    )
    const summary: MusicStatsSummary = {
      source: resolved.info,
      overview,
      topArtists: buildTopArtists(uniqueSongs),
      topAlbums: buildTopAlbums(uniqueSongs),
      timeDistribution: buildTimeDistribution(uniqueSongs, resolved.info.type),
      recentSongs: buildTimeSongs(uniqueSongs, resolved.info.type, 'desc'),
      earliestSongs: buildTimeSongs(uniqueSongs, resolved.info.type, 'asc'),
      playlistOverview: resolved.playlistOverview,
      generatedAt: nowIso()
    }

    logger.info('音乐统计生成完成', {
      sourceType: resolved.info.type,
      sourceName: resolved.info.name,
      songCount: summary.overview.songCount,
      uniqueSongCount: summary.overview.uniqueSongCount,
      topArtistCount: summary.topArtists.length,
      topAlbumCount: summary.topAlbums.length,
      yearBucketCount: summary.timeDistribution.byYear.length,
      monthBucketCount: summary.timeDistribution.byMonth.length
    })

    return summary
  }

  async getAvailableStatisticsSources(): Promise<StatisticsSourceInfo[]> {
    const sources: StatisticsSourceInfo[] = [
      {
        type: 'liked',
        name: '我喜欢的音乐',
        timeField: 'likedAt'
      },
      {
        type: 'all',
        name: '全部已同步歌曲',
        timeField: 'mixed'
      }
    ]
    const playlistSources = this.statisticsRepository
      .getSyncedPlaylistsForStats()
      .filter((playlist) => playlist.type !== 'liked')
      .map<StatisticsSourceInfo>((playlist) => ({
        type: 'playlist',
        id: playlist.id,
        name: playlist.name,
        timeField: 'addedAt'
      }))

    return [...sources, ...playlistSources]
  }

  async getAnalysisDataset(source: StatisticsSource): Promise<MusicAnalysisDataset> {
    const resolved = this.resolveStatsSource(source)
    const summary = await this.getMusicStatsSummary(source)
    const uniqueSongs = dedupeSongs(
      normalizeSongsForStats(resolved.songs, resolved.info.type),
      resolved.info.type
    )
    const compactSongs = sampleAnalysisSongs(uniqueSongs, resolved.info.type)

    return {
      source: summary.source,
      summary,
      compactSongs,
      generatedAt: nowIso()
    }
  }

  private resolveStatsSource(source: StatisticsSource): ResolvedStatsSource {
    if (source.type === 'liked') {
      return {
        info: {
          type: 'liked',
          name: '我喜欢的音乐',
          timeField: 'likedAt'
        },
        songs: this.statisticsRepository.getLikedSongsForStats()
      }
    }

    if (source.type === 'all') {
      return {
        info: {
          type: 'all',
          name: '全部已同步歌曲',
          timeField: 'mixed'
        },
        songs: this.statisticsRepository.getAllSyncedSongsForStats(),
        playlistOverview: this.statisticsRepository.getPlaylistStatsOverview()
      }
    }

    const playlist = this.statisticsRepository.getPlaylistById(source.playlistId)

    if (!playlist) {
      throw new Error('指定歌单不存在，可能是本地缓存已清空')
    }

    return {
      info: {
        type: 'playlist',
        id: playlist.id,
        name: playlist.name,
        timeField: 'addedAt'
      },
      songs: this.statisticsRepository.getPlaylistTracksForStats(playlist.id)
    }
  }
}
