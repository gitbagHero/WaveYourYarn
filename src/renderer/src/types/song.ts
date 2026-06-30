export interface Song {
  id: string
  ncmSongId: string
  name: string
  artists: string[]
  album?: string
  duration?: number
  coverUrl?: string
  orderIndex?: number
}
