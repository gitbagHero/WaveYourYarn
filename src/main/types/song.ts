export interface Song {
  id: string
  ncmSongId: string
  name: string
  artists: string[]
  album?: string
  duration?: number
  coverUrl?: string
  alias?: string[]
  orderIndex?: number
  rawData?: unknown
  createdAt: string
  updatedAt: string
}

export interface SyncLikedSongsTask {
  status: 'idle' | 'running' | 'success' | 'failed'
  total: number
  finished: number
  successCount: number
  failedCount: number
  message?: string
}
