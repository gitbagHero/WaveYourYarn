import type { Database } from 'better-sqlite3'
import { nanoid } from 'nanoid'
import { getDatabase } from '../database'
import type { Playlist, PlaylistType } from '../../types/playlist'
import type { LikedSong, PlaylistTrack } from '../../types/song'
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
      ownerUserId: userId,
      type: 'liked',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }

    this.upsertPlaylist(playlist)

    return playlist
  }

  upsertPlaylist(playlist: Playlist): void {
    const existing = this.findByNcmPlaylistId(playlist.ncmPlaylistId)
    const record = {
      ...playlist,
      id: existing?.id ?? playlist.id,
      createdAt: existing?.createdAt ?? playlist.createdAt
    }
    const params = toPlaylistRowParams(record)

    if (existing) {
      this.db
        .prepare(
          `UPDATE playlists SET
            ncm_playlist_id = @ncmPlaylistId,
            name = @name,
            description = @description,
            cover_url = @coverUrl,
            track_count = @trackCount,
            owner_user_id = @ownerUserId,
            owner_nickname = @ownerNickname,
            type = @type,
            subscribed = @subscribed,
            special_type = @specialType,
            play_count = @playCount,
            update_time = @updateTime,
            create_time = @createTime,
            raw_data = @rawData,
            updated_at = @updatedAt
           WHERE id = @id`
        )
        .run(params)
      return
    }

    this.db
      .prepare(
        `INSERT INTO playlists (
          id, ncm_playlist_id, name, description, cover_url, track_count,
          owner_user_id, owner_nickname, type, subscribed, special_type,
          play_count, update_time, create_time, raw_data, created_at, updated_at
        )
        VALUES (
          @id, @ncmPlaylistId, @name, @description, @coverUrl, @trackCount,
          @ownerUserId, @ownerNickname, @type, @subscribed, @specialType,
          @playCount, @updateTime, @createTime, @rawData, @createdAt, @updatedAt
        )`
      )
      .run(params)
  }

  upsertPlaylists(playlists: Playlist[]): void {
    for (const playlist of playlists) {
      this.upsertPlaylist(playlist)
    }
  }

  findById(id: string): Playlist | null {
    const row = this.db.prepare('SELECT * FROM playlists WHERE id = ?').get(id) as PlaylistRow | undefined
    return row ? fromPlaylistRow(row) : null
  }

  findByNcmPlaylistId(ncmPlaylistId: string): Playlist | null {
    const row = this.db.prepare('SELECT * FROM playlists WHERE ncm_playlist_id = ?').get(ncmPlaylistId) as
      | PlaylistRow
      | undefined
    return row ? fromPlaylistRow(row) : null
  }

  findAll(): Playlist[] {
    const rows = this.db.prepare('SELECT * FROM playlists').all() as PlaylistRow[]
    return rows.map(fromPlaylistRow).sort(comparePlaylists)
  }

  findByType(type: PlaylistType): Playlist[] {
    const rows = this.db.prepare('SELECT * FROM playlists WHERE type = ?').all(type) as PlaylistRow[]
    return rows.map(fromPlaylistRow).sort(comparePlaylists)
  }

  search(keyword: string): Playlist[] {
    const trimmed = keyword.trim()

    if (!trimmed) {
      return this.findAll()
    }

    const like = `%${trimmed}%`
    const rows = this.db
      .prepare(
        `SELECT * FROM playlists
         WHERE name LIKE @like
            OR description LIKE @like
            OR owner_nickname LIKE @like`
      )
      .all({ like }) as PlaylistRow[]

    return rows.map(fromPlaylistRow).sort(comparePlaylists)
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
    return this.getPlaylistSongs(playlistId).map((track) => ({
      ...track,
      likedAt: track.addedAt
    }))
  }

  getPlaylistSongs(playlistId: string): PlaylistTrack[] {
    const rows = this.db
      .prepare(
        `SELECT songs.*, playlist_songs.order_index, playlist_songs.added_at
         FROM playlist_songs
         INNER JOIN songs ON songs.id = playlist_songs.song_id
         WHERE playlist_songs.playlist_id = ?
         ORDER BY playlist_songs.order_index ASC`
      )
      .all(playlistId) as SongRow[]

    return rows.map((row) => fromPlaylistTrackRow(row, playlistId))
  }

  searchPlaylistSongs(playlistId: string, keyword: string): PlaylistTrack[] {
    const trimmed = keyword.trim()

    if (!trimmed) {
      return this.getPlaylistSongs(playlistId)
    }

    const rows = this.db
      .prepare(
        `SELECT songs.*, playlist_songs.order_index, playlist_songs.added_at
         FROM playlist_songs
         INNER JOIN songs ON songs.id = playlist_songs.song_id
         WHERE playlist_songs.playlist_id = @playlistId
           AND (
             songs.name LIKE @like
             OR songs.album LIKE @like
             OR songs.artists_json LIKE @like
           )
         ORDER BY playlist_songs.order_index ASC`
      )
      .all({ playlistId, like: `%${trimmed}%` }) as SongRow[]

    return rows.map((row) => fromPlaylistTrackRow(row, playlistId))
  }

  clearPlaylistSongs(playlistId: string): void {
    this.db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ?').run(playlistId)
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

  clearNonLikedPlaylists(): void {
    const rows = this.db.prepare("SELECT id FROM playlists WHERE type != 'liked'").all() as Array<{
      id: string
    }>

    for (const row of rows) {
      this.db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ?').run(row.id)
    }

    this.db.prepare("DELETE FROM playlists WHERE type != 'liked'").run()
  }
}

function fromPlaylistTrackRow(row: SongRow, playlistId: string): PlaylistTrack {
  return {
    ...fromSongRow(row),
    playlistId,
    orderIndex: row.order_index ?? Number.MAX_SAFE_INTEGER,
    addedAt: row.added_at ?? undefined
  }
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
    ownerUserId: row.owner_user_id ?? undefined,
    ownerNickname: row.owner_nickname ?? undefined,
    type: row.type,
    subscribed: typeof row.subscribed === 'number' ? row.subscribed === 1 : undefined,
    specialType: row.special_type ?? undefined,
    playCount: row.play_count ?? undefined,
    updateTime: row.update_time ?? undefined,
    createTime: row.create_time ?? undefined,
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
    ownerUserId: playlist.ownerUserId ?? null,
    ownerNickname: playlist.ownerNickname ?? null,
    type: playlist.type,
    subscribed: typeof playlist.subscribed === 'boolean' ? (playlist.subscribed ? 1 : 0) : null,
    specialType: playlist.specialType ?? null,
    playCount: playlist.playCount ?? null,
    updateTime: playlist.updateTime ?? null,
    createTime: playlist.createTime ?? null,
    rawData: playlist.rawData ? JSON.stringify(playlist.rawData) : null,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt
  }
}

function comparePlaylists(a: Playlist, b: Playlist): number {
  const typeRank: Record<PlaylistType, number> = {
    liked: 0,
    created: 1,
    subscribed: 2,
    unknown: 3
  }
  const typeDiff = typeRank[a.type] - typeRank[b.type]

  if (typeDiff !== 0) {
    return typeDiff
  }

  const aTime = a.updateTime ?? Date.parse(a.updatedAt)
  const bTime = b.updateTime ?? Date.parse(b.updatedAt)
  return bTime - aTime
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
