import type { Database } from 'better-sqlite3'
import { getDatabase } from '../database'
import type { Playlist, PlaylistType } from '../../types/playlist'
import type { LikedSong, PlaylistTrack } from '../../types/song'
import type { PlaylistStatsOverview } from '../../types/statistics'

interface StatsSongRow {
  id: string
  ncm_song_id: string
  name: string
  artists_json: string
  album: string | null
  duration: number | null
  cover_url: string | null
  alias_json: string | null
  created_at: string
  updated_at: string
  playlist_id: string
  order_index: number | null
  added_at: number | null
}

interface PlaylistRow {
  id: string
  ncm_playlist_id: string
  name: string
  description: string | null
  cover_url: string | null
  track_count: number | null
  owner_user_id: string | null
  owner_nickname: string | null
  type: PlaylistType
  subscribed: number | null
  special_type: number | null
  play_count: number | null
  update_time: number | null
  create_time: number | null
  created_at: string
  updated_at: string
}

interface PlaylistCountRow {
  type: PlaylistType
  count: number
}

export class StatisticsRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  getLikedSongsForStats(): LikedSong[] {
    const rows = this.db
      .prepare(
        `SELECT songs.*, playlist_songs.playlist_id, playlist_songs.order_index, playlist_songs.added_at
         FROM playlist_songs
         INNER JOIN songs ON songs.id = playlist_songs.song_id
         INNER JOIN playlists ON playlists.id = playlist_songs.playlist_id
         WHERE playlists.type = 'liked'
         ORDER BY playlist_songs.order_index ASC`
      )
      .all() as StatsSongRow[]

    return rows.map((row) => ({
      ...fromStatsSongRow(row),
      orderIndex: row.order_index ?? Number.MAX_SAFE_INTEGER,
      likedAt: row.added_at ?? undefined
    }))
  }

  getPlaylistTracksForStats(playlistId: string): PlaylistTrack[] {
    const rows = this.db
      .prepare(
        `SELECT songs.*, playlist_songs.playlist_id, playlist_songs.order_index, playlist_songs.added_at
         FROM playlist_songs
         INNER JOIN songs ON songs.id = playlist_songs.song_id
         WHERE playlist_songs.playlist_id = ?
         ORDER BY playlist_songs.order_index ASC`
      )
      .all(playlistId) as StatsSongRow[]

    return rows.map((row) => ({
      ...fromStatsSongRow(row),
      playlistId,
      orderIndex: row.order_index ?? Number.MAX_SAFE_INTEGER,
      addedAt: row.added_at ?? undefined
    }))
  }

  getAllSyncedSongsForStats(): Array<LikedSong | PlaylistTrack> {
    const rows = this.db
      .prepare(
        `SELECT songs.*, playlist_songs.playlist_id, playlist_songs.order_index, playlist_songs.added_at,
                playlists.type as playlist_type
         FROM playlist_songs
         INNER JOIN songs ON songs.id = playlist_songs.song_id
         INNER JOIN playlists ON playlists.id = playlist_songs.playlist_id
         ORDER BY playlist_songs.added_at DESC, playlist_songs.order_index ASC`
      )
      .all() as Array<StatsSongRow & { playlist_type: PlaylistType }>

    return rows.map((row) => {
      const song = fromStatsSongRow(row)
      const orderIndex = row.order_index ?? Number.MAX_SAFE_INTEGER

      if (row.playlist_type === 'liked') {
        return {
          ...song,
          orderIndex,
          likedAt: row.added_at ?? undefined
        }
      }

      return {
        ...song,
        playlistId: row.playlist_id,
        orderIndex,
        addedAt: row.added_at ?? undefined
      }
    })
  }

  getPlaylistStatsOverview(): PlaylistStatsOverview {
    const rows = this.db
      .prepare('SELECT type, COUNT(*) as count FROM playlists GROUP BY type')
      .all() as PlaylistCountRow[]
    const totalTracksRow = this.db
      .prepare(
        `SELECT COUNT(DISTINCT songs.ncm_song_id) as count
         FROM playlist_songs
         INNER JOIN songs ON songs.id = playlist_songs.song_id`
      )
      .get() as { count: number }
    const syncedPlaylistRow = this.db
      .prepare('SELECT COUNT(DISTINCT playlist_id) as count FROM playlist_songs')
      .get() as { count: number }
    const countByType = new Map<PlaylistType, number>(rows.map((row) => [row.type, row.count]))
    const rawLikedCount = countByType.get('liked') ?? 0
    const likedCount = rawLikedCount > 0 ? 1 : 0
    const duplicateLikedCount = Math.max(0, rawLikedCount - likedCount)

    return {
      totalPlaylists: rows.reduce((total, row) => total + row.count, 0) - duplicateLikedCount,
      likedCount,
      createdCount: countByType.get('created') ?? 0,
      subscribedCount: countByType.get('subscribed') ?? 0,
      unknownCount: countByType.get('unknown') ?? 0,
      totalTracksInPlaylists: totalTracksRow.count,
      syncedPlaylistCount: Math.max(0, syncedPlaylistRow.count - duplicateLikedCount)
    }
  }

  getPlaylistById(playlistId: string): Playlist | null {
    const row = this.db
      .prepare('SELECT * FROM playlists WHERE id = ?')
      .get(playlistId) as PlaylistRow | undefined

    return row ? fromPlaylistRow(row) : null
  }

  getSyncedPlaylistsForStats(): Playlist[] {
    const rows = this.db
      .prepare(
        `SELECT playlists.*
         FROM playlists
         WHERE EXISTS (
           SELECT 1 FROM playlist_songs WHERE playlist_songs.playlist_id = playlists.id
         )
         ORDER BY playlists.type ASC, playlists.updated_at DESC`
      )
      .all() as PlaylistRow[]

    return rows.map(fromPlaylistRow)
  }
}

function fromStatsSongRow(row: StatsSongRow): Omit<LikedSong, 'orderIndex' | 'likedAt'> {
  return {
    id: row.id,
    ncmSongId: row.ncm_song_id,
    name: row.name,
    artists: parseJsonArray(row.artists_json),
    album: row.album ?? undefined,
    duration: row.duration ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    alias: parseJsonArray(row.alias_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function fromPlaylistRow(row: PlaylistRow): Playlist {
  return {
    id: row.id,
    ncmPlaylistId: row.ncm_playlist_id,
    name: row.name,
    description: row.description ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    trackCount: row.track_count ?? undefined,
    ownerUserId: row.owner_user_id ?? undefined,
    ownerNickname: row.owner_nickname ?? undefined,
    type: row.type,
    subscribed: typeof row.subscribed === 'number' ? row.subscribed === 1 : undefined,
    specialType: row.special_type ?? undefined,
    playCount: row.play_count ?? undefined,
    updateTime: row.update_time ?? undefined,
    createTime: row.create_time ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function parseJsonArray(value: string | null): string[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}
