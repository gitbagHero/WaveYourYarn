export interface Playlist {
  id: string
  ncmPlaylistId: string
  name: string
  description?: string
  coverUrl?: string
  trackCount?: number
  type: 'liked' | 'created' | 'subscribed'
  rawData?: unknown
  createdAt: string
  updatedAt: string
}
