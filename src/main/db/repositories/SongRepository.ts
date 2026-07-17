import type { Database } from 'better-sqlite3'
import { getDatabase } from '../database'
import type { Song } from '../../types/song'

export class SongRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM songs').get() as { count: number }
    return row.count
  }

  upsertSong(song: Song): void {
    this.db
      .prepare(
        `INSERT INTO songs (
          id, ncm_song_id, name, artists_json, album, duration, cover_url,
          alias_json, raw_data, created_at, updated_at
        )
        VALUES (
          @id, @ncmSongId, @name, @artistsJson, @album, @duration, @coverUrl,
          @aliasJson, @rawData, @createdAt, @updatedAt
        )
        ON CONFLICT(ncm_song_id) DO UPDATE SET
          name = excluded.name,
          artists_json = excluded.artists_json,
          album = excluded.album,
          duration = excluded.duration,
          cover_url = excluded.cover_url,
          alias_json = excluded.alias_json,
          raw_data = excluded.raw_data,
          updated_at = excluded.updated_at`
      )
      .run(toSongRowParams(song))
  }

  upsertSongs(songs: Song[]): void {
    for (const song of songs) {
      this.upsertSong(song)
    }
  }

  findByNcmSongId(ncmSongId: string): Song | null {
    const row = this.db.prepare('SELECT * FROM songs WHERE ncm_song_id = ?').get(ncmSongId) as
      | SongRow
      | undefined

    return row ? fromSongRow(row) : null
  }

  findAll(): Song[] {
    const rows = this.db.prepare('SELECT * FROM songs ORDER BY updated_at DESC, name ASC').all() as SongRow[]
    return rows.map(fromSongRow)
  }

  search(keyword: string): Song[] {
    const trimmed = keyword.trim()

    if (!trimmed) {
      return this.findAll()
    }

    const like = `%${trimmed}%`
    const rows = this.db
      .prepare(
        `SELECT * FROM songs
         WHERE name LIKE @like
            OR album LIKE @like
            OR artists_json LIKE @like
         ORDER BY updated_at DESC, name ASC`
      )
      .all({ like }) as SongRow[]

    return rows.map(fromSongRow)
  }

  clearAllSongs(): void {
    this.db.prepare('DELETE FROM songs').run()
  }

  deleteOrphanSongs(): number {
    const result = this.db
      .prepare(
        `DELETE FROM songs
         WHERE NOT EXISTS (
           SELECT 1
           FROM playlist_songs
           WHERE playlist_songs.song_id = songs.id
         )`
      )
      .run()

    return result.changes
  }
}

export interface SongRow {
  id: string
  ncm_song_id: string
  name: string
  artists_json: string
  album: string | null
  duration: number | null
  cover_url: string | null
  alias_json: string | null
  raw_data: string | null
  created_at: string
  updated_at: string
  order_index?: number | null
  added_at?: number | null
}

export function fromSongRow(row: SongRow): Song {
  return {
    id: row.id,
    ncmSongId: row.ncm_song_id,
    name: row.name,
    artists: parseJsonArray(row.artists_json),
    album: row.album ?? undefined,
    duration: row.duration ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    alias: parseJsonArray(row.alias_json),
    rawData: parseJson(row.raw_data),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toSongRowParams(song: Song): Record<string, unknown> {
  return {
    id: song.id,
    ncmSongId: song.ncmSongId,
    name: song.name,
    artistsJson: JSON.stringify(song.artists),
    album: song.album ?? null,
    duration: song.duration ?? null,
    coverUrl: song.coverUrl ?? null,
    aliasJson: song.alias ? JSON.stringify(song.alias) : null,
    rawData: song.rawData ? JSON.stringify(song.rawData) : null,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt
  }
}

function parseJsonArray(value: string | null): string[] {
  const parsed = parseJson(value)
  return Array.isArray(parsed) ? parsed.map(String) : []
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
