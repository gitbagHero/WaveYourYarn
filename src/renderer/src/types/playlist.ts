export type PlaylistType = 'liked' | 'created' | 'subscribed' | 'unknown'

export interface Playlist {
  id: string
  ncmPlaylistId: string
  name: string
  description?: string
  coverUrl?: string
  trackCount?: number
  ownerUserId?: string
  ownerNickname?: string
  type: PlaylistType
  subscribed?: boolean
  specialType?: number
  playCount?: number
  updateTime?: number
  createTime?: number
  rawData?: unknown
  createdAt: string
  updatedAt: string
}

export interface SyncPlaylistsResult {
  total: number
  createdCount: number
  subscribedCount: number
  likedCount: number
  unknownCount: number
  syncedAt: string
}

export interface SyncPlaylistSongsResult {
  playlistId: string
  ncmPlaylistId: string
  total: number
  successCount: number
  failedCount: number
  failedSongIds: string[]
  syncedAt: string
  hasAddedAt: boolean
}

export interface SyncAllPlaylistSongsResult {
  totalPlaylists: number
  successPlaylistCount: number
  failedPlaylistCount: number
  totalTracks: number
  successTrackCount: number
  failedTrackCount: number
  failedPlaylists: Array<{
    playlistId: string
    ncmPlaylistId: string
    name: string
    message: string
  }>
  syncedAt: string
}
