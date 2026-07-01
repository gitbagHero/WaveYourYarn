export interface Song {
  id: string
  ncmSongId: string
  name: string
  artists: string[]
  album?: string
  duration?: number
  coverUrl?: string
  alias?: string[]
  rawData?: unknown
  createdAt: string
  updatedAt: string
}

export interface LikedSong extends Song {
  orderIndex: number
  likedAt?: number
}

export interface SyncLikedSongsTask {
  status: 'idle' | 'running' | 'success' | 'failed'
  total: number
  finished: number
  successCount: number
  failedCount: number
  message?: string
}

export interface SyncLikedSongsResult {
  total: number
  successCount: number
  failedCount: number
  failedSongIds: string[]
  syncedAt: string
  hasLikedAt: boolean
  source: 'playlist_detail' | 'likelist_fallback'
}
