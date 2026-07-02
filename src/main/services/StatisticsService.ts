import { StatisticsRepository } from '../db/repositories/StatisticsRepository'
import type { LikedSong, PlaylistTrack } from '../types/song'
import type {
  AlbumStat,
  ArtistStat,
  CompactSongForAnalysis,
  MusicAnalysisDataset,
  MusicStatsOverview,
  MusicStatsSummary,
  PlaylistStatsOverview,
  SongTimeStat,
  StatisticsSource,
  StatisticsSourceInfo,
  StatisticsSourceType,
  TimeDistribution
} from '../types/statistics'
import { logger } from '../utils/logger'
import { nowIso } from '../utils/time'

const TOP_LIMIT = 20
const SONG_TIME_LIMIT = 20
const ANALYSIS_SONG_LIMIT = 300

type StatSong = LikedSong | PlaylistTrack

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

function buildOverview(
  songs: StatSong[],
  uniqueSongs: StatSong[],
  sourceType: StatisticsSourceType,
  playlistOverview?: PlaylistStatsOverview
): MusicStatsOverview {
  const artistNames = new Set<string>()
  const albumNames = new Set<string>()
  const times = uniqueSongs
    .map((song) => getSongTime(song, sourceType))
    .filter((time): time is number => typeof time === 'number')

  for (const song of uniqueSongs) {
    for (const artist of song.artists) {
      if (artist.trim()) {
        artistNames.add(artist.trim())
      }
    }

    albumNames.add((song.album ?? '未知专辑').trim() || '未知专辑')
  }

  const earliestTime = times.length > 0 ? Math.min(...times) : undefined
  const latestTime = times.length > 0 ? Math.max(...times) : undefined

  return {
    songCount: songs.length,
    uniqueSongCount: uniqueSongs.length,
    artistCount: artistNames.size,
    albumCount: albumNames.size,
    playlistCount: playlistOverview?.totalPlaylists,
    earliestTime,
    latestTime,
    timeCoverageLabel:
      earliestTime && latestTime ? `${formatMonth(earliestTime)} 至 ${formatMonth(latestTime)}` : undefined
  }
}

function buildTopArtists(songs: StatSong[]): ArtistStat[] {
  const stats = new Map<string, ArtistStat>()
  const denominator = Math.max(1, songs.length)

  for (const song of songs) {
    for (const artist of song.artists) {
      const name = artist.trim() || '未知歌手'
      const stat = stats.get(name) ?? {
        name,
        count: 0,
        percentage: 0,
        sampleSongs: []
      }

      stat.count += 1
      if (stat.sampleSongs.length < 3) {
        stat.sampleSongs.push({
          ncmSongId: song.ncmSongId,
          name: song.name
        })
      }
      stats.set(name, stat)
    }
  }

  return [...stats.values()]
    .map((stat) => ({
      ...stat,
      percentage: roundPercentage((stat.count / denominator) * 100)
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, TOP_LIMIT)
}

function buildTopAlbums(songs: StatSong[]): AlbumStat[] {
  const stats = new Map<string, AlbumStat>()
  const denominator = Math.max(1, songs.length)

  for (const song of songs) {
    const name = (song.album ?? '未知专辑').trim() || '未知专辑'
    const stat = stats.get(name) ?? {
      name,
      artistNames: [],
      count: 0,
      percentage: 0,
      sampleSongs: []
    }

    stat.count += 1
    for (const artist of song.artists) {
      if (artist.trim() && !stat.artistNames.includes(artist.trim())) {
        stat.artistNames.push(artist.trim())
      }
    }
    if (stat.sampleSongs.length < 3) {
      stat.sampleSongs.push({
        ncmSongId: song.ncmSongId,
        name: song.name
      })
    }
    stats.set(name, stat)
  }

  return [...stats.values()]
    .map((stat) => ({
      ...stat,
      artistNames: stat.artistNames.slice(0, 5),
      percentage: roundPercentage((stat.count / denominator) * 100)
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, TOP_LIMIT)
}

function buildTimeDistribution(songs: StatSong[], sourceType: StatisticsSourceType): TimeDistribution {
  const byYear = new Map<string, number>()
  const byMonth = new Map<string, number>()

  for (const song of songs) {
    const time = getSongTime(song, sourceType)

    if (!time) {
      continue
    }

    const date = new Date(time)
    const year = String(date.getFullYear())
    const month = formatMonth(time)

    byYear.set(year, (byYear.get(year) ?? 0) + 1)
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1)
  }

  return {
    byYear: [...byYear.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, count]) => ({ year, count })),
    byMonth: [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }))
  }
}

function buildTimeSongs(
  songs: StatSong[],
  sourceType: StatisticsSourceType,
  direction: 'asc' | 'desc'
): SongTimeStat[] {
  return songs
    .map((song) => ({
      song,
      time: getSongTime(song, sourceType)
    }))
    .filter((item): item is { song: StatSong; time: number } => typeof item.time === 'number')
    .sort((a, b) => (direction === 'desc' ? b.time - a.time : a.time - b.time))
    .slice(0, SONG_TIME_LIMIT)
    .map(({ song, time }) => ({
      ncmSongId: song.ncmSongId,
      name: song.name,
      artists: song.artists,
      album: song.album,
      time,
      timeLabel: new Date(time).toLocaleString(),
      orderIndex: song.orderIndex
    }))
}

function normalizeSongsForStats(songs: StatSong[], sourceType: StatisticsSourceType): StatSong[] {
  if (sourceType === 'playlist') {
    return songs
  }

  return dedupeSongs(songs, sourceType)
}

function dedupeSongs(songs: StatSong[], sourceType: StatisticsSourceType): StatSong[] {
  const bySongId = new Map<string, StatSong>()

  for (const song of songs) {
    const existing = bySongId.get(song.ncmSongId)

    if (!existing) {
      bySongId.set(song.ncmSongId, song)
      continue
    }

    const currentTime = getSongTime(song, sourceType) ?? 0
    const existingTime = getSongTime(existing, sourceType) ?? 0

    if (currentTime > existingTime || (currentTime === existingTime && song.orderIndex < existing.orderIndex)) {
      bySongId.set(song.ncmSongId, {
        ...existing,
        ...song,
        orderIndex: Math.min(existing.orderIndex, song.orderIndex)
      } as StatSong)
    }
  }

  return [...bySongId.values()]
}

function sampleAnalysisSongs(songs: StatSong[], sourceType: StatisticsSourceType): CompactSongForAnalysis[] {
  return [...songs]
    .sort((a, b) => {
      const aTime = getSongTime(a, sourceType) ?? 0
      const bTime = getSongTime(b, sourceType) ?? 0
      return bTime - aTime
    })
    .slice(0, ANALYSIS_SONG_LIMIT)
    .map((song) => ({
      name: song.name,
      artists: song.artists,
      album: song.album,
      time: getSongTime(song, sourceType) ?? undefined,
      orderIndex: song.orderIndex
    }))
}

function getSongTime(song: StatSong, sourceType: StatisticsSourceType): number | null {
  if (sourceType === 'liked') {
    return 'likedAt' in song && song.likedAt ? song.likedAt : null
  }

  if (sourceType === 'playlist') {
    return 'addedAt' in song && song.addedAt ? song.addedAt : null
  }

  const likedAt = 'likedAt' in song && song.likedAt ? song.likedAt : null
  const addedAt = 'addedAt' in song && song.addedAt ? song.addedAt : null

  if (likedAt && addedAt) {
    return Math.max(likedAt, addedAt)
  }

  return likedAt ?? addedAt
}

function formatMonth(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 7)
}

function roundPercentage(value: number): number {
  return Math.round(value * 10) / 10
}
