export type StatisticsSource =
  | { type: 'liked' }
  | { type: 'playlist'; playlistId: string }
  | { type: 'all' }

export type StatisticsSourceType = StatisticsSource['type']
export type StatisticsTimeField = 'likedAt' | 'addedAt' | 'mixed' | 'none'

export interface StatisticsSourceInfo {
  type: StatisticsSourceType
  id?: string
  name: string
  timeField: StatisticsTimeField
}

export interface MusicStatsOverview {
  songCount: number
  uniqueSongCount: number
  artistCount: number
  albumCount: number
  playlistCount?: number
  earliestTime?: number
  latestTime?: number
  timeCoverageLabel?: string
}

export interface ArtistStat {
  name: string
  count: number
  percentage: number
  sampleSongs: Array<{
    ncmSongId: string
    name: string
  }>
}

export interface AlbumStat {
  name: string
  artistNames: string[]
  count: number
  percentage: number
  sampleSongs: Array<{
    ncmSongId: string
    name: string
  }>
}

export interface TimeDistribution {
  byYear: Array<{
    year: string
    count: number
  }>
  byMonth: Array<{
    month: string
    count: number
  }>
}

export interface SongTimeStat {
  ncmSongId: string
  name: string
  artists: string[]
  album?: string
  time?: number
  timeLabel?: string
  orderIndex?: number
}

export interface PlaylistStatsOverview {
  totalPlaylists: number
  likedCount: number
  createdCount: number
  subscribedCount: number
  unknownCount: number
  totalTracksInPlaylists?: number
  syncedPlaylistCount?: number
}

export interface MusicStatsSummary {
  source: StatisticsSourceInfo
  overview: MusicStatsOverview
  topArtists: ArtistStat[]
  topAlbums: AlbumStat[]
  timeDistribution: TimeDistribution
  recentSongs: SongTimeStat[]
  earliestSongs: SongTimeStat[]
  playlistOverview?: PlaylistStatsOverview
  generatedAt: string
}

export interface CompactSongForAnalysis {
  name: string
  artists: string[]
  album?: string
  time?: number
  orderIndex?: number
}

export interface MusicAnalysisDataset {
  source: StatisticsSourceInfo
  summary: MusicStatsSummary
  compactSongs: CompactSongForAnalysis[]
  generatedAt: string
}
