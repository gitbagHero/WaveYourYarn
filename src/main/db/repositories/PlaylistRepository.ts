import type { Database } from 'better-sqlite3'
import { nanoid } from 'nanoid'
import { getDatabase } from '../database'
import type { Playlist } from '../../types/playlist'
import type { LikedSong } from '../../types/song'
import { nowIso } from '../../utils/time'
import { fromSongRow, type SongRow } from './SongRepository'

export class PlaylistRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM playlists').get() as { count: number }
    return row.count
  }

  upsertLikedPlaylist(userId: string, trackCount: number): Playlist {
    const ncmPlaylistId = toLikedPlaylistId(userId)
    const existing = this.getLikedPlaylist(userId)
    const now = nowIso()
    const playlist: Playlist = {
      id: existing?.id ?? nanoid(),
      ncmPlaylistId,
      name: '我喜欢的音乐',
      description: '网易云音乐喜欢列表本地缓存',
      trackCount,
      type: 'liked',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }

    this.db
      .prepare(
        `INSERT INTO playlists (
          id, ncm_playlist_id, name, description, cover_url, track_count,
          type, raw_data, created_at, updated_at
        )
        VALUES (
          @id, @ncmPlaylistId, @name, @description, @coverUrl, @trackCount,
          @type, @rawData, @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          ncm_playlist_id = excluded.ncm_playlist_id,
          name = excluded.name,
          description = excluded.description,
          cover_url = excluded.cover_url,
          track_count = excluded.track_count,
          type = excluded.type,
          raw_data = excluded.raw_data,
          updated_at = excluded.updated_at`
      )
      .run(toPlaylistRowParams(playlist))

    return playlist
  }

  replacePlaylistSongs(
    playlistId: string,
    songItems: Array<{ songId: string; orderIndex: number; addedAt?: number }>
  ): void {
    this.db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ?').run(playlistId)

    const insert = this.db.prepare(
      `INSERT INTO playlist_songs (id, playlist_id, song_id, order_index, added_at, created_at)
       VALUES (@id, @playlistId, @songId, @orderIndex, @addedAt, @createdAt)`
    )
    const now = nowIso()

    for (const item of songItems) {
      insert.run({
        id: nanoid(),
        playlistId,
        songId: item.songId,
        orderIndex: item.orderIndex,
        addedAt: item.addedAt ?? null,
        createdAt: now
      })
    }
  }

  getLikedPlaylist(userId: string): Playlist | null {
    const row = this.db
      .prepare("SELECT * FROM playlists WHERE ncm_playlist_id = ? AND type = 'liked'")
      .get(toLikedPlaylistId(userId)) as PlaylistRow | undefined

    return row ? fromPlaylistRow(row) : null
  }

  getSongsByPlaylistId(playlistId: string): LikedSong[] {
    const rows = this.db
      .prepare(
        `SELECT songs.*, playlist_songs.order_index, playlist_songs.added_at
         FROM playlist_songs
         INNER JOIN songs ON songs.id = playlist_songs.song_id
         WHERE playlist_songs.playlist_id = ?
         ORDER BY playlist_songs.order_index ASC`
      )
      .all(playlistId) as SongRow[]

    return rows.map(fromLikedSongRow)
  }

  getLikedSongsWithMeta(userId: string): LikedSong[] {
    const playlist = this.getLikedPlaylist(userId)

    return playlist ? this.getSongsByPlaylistId(playlist.id) : []
  }

  clearLikedPlaylists(): void {
    const likedPlaylistRows = this.db.prepare("SELECT id FROM playlists WHERE type = 'liked'").all() as Array<{
      id: string
    }>

    for (const playlist of likedPlaylistRows) {
      this.db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ?').run(playlist.id)
    }

    this.db.prepare("DELETE FROM playlists WHERE type = 'liked'").run()
  }
}

function fromLikedSongRow(row: SongRow): LikedSong {
  return {
    ...fromSongRow(row),
    orderIndex: row.order_index ?? Number.MAX_SAFE_INTEGER,
    likedAt: row.added_at ?? undefined
  }
}

interface PlaylistRow {
  id: string
  ncm_playlist_id: string
  name: string
  description: string | null
  cover_url: string | null
  track_count: number | null
  type: 'liked' | 'created' | 'subscribed'
  raw_data: string | null
  created_at: string
  updated_at: string
}

function fromPlaylistRow(row: PlaylistRow): Playlist {
  return {
    id: row.id,
    ncmPlaylistId: row.ncm_playlist_id,
    name: row.name,
    description: row.description ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    trackCount: row.track_count ?? undefined,
    type: row.type,
    rawData: parseJson(row.raw_data),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toPlaylistRowParams(playlist: Playlist): Record<string, unknown> {
  return {
    id: playlist.id,
    ncmPlaylistId: playlist.ncmPlaylistId,
    name: playlist.name,
    description: playlist.description ?? null,
    coverUrl: playlist.coverUrl ?? null,
    trackCount: playlist.trackCount ?? null,
    type: playlist.type,
    rawData: playlist.rawData ? JSON.stringify(playlist.rawData) : null,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt
  }
}

function toLikedPlaylistId(userId: string): string {
  return `liked:${userId}`
}

function parseJson(value: string | null): unknown {
  if (!value) {
    return undefined
  }

  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}
