import { nanoid } from 'nanoid'
import type { Song } from '../../types/song'
import { nowIso } from '../../utils/time'

export type NcmSongDetail = Record<string, unknown>

export function mapNcmSongToSong(raw: NcmSongDetail): Song {
  const now = nowIso()
  const artists = Array.isArray(raw.ar)
    ? raw.ar.map((artist) => readString((artist as Record<string, unknown>)?.name)).filter(Boolean)
    : Array.isArray(raw.artists)
      ? raw.artists.map((artist) => readString((artist as Record<string, unknown>)?.name)).filter(Boolean)
      : []
  const albumRecord = readRecord(raw.al) ?? readRecord(raw.album)
  const alias = Array.isArray(raw.alia)
    ? raw.alia.map((item) => readString(item)).filter(Boolean)
    : Array.isArray(raw.alias)
      ? raw.alias.map((item) => readString(item)).filter(Boolean)
      : undefined

  return {
    id: nanoid(),
    ncmSongId: String(raw.id),
    name: readString(raw.name) || '未知歌曲',
    artists,
    album: readString(albumRecord?.name) || undefined,
    duration: readNumber(raw.dt ?? raw.duration),
    coverUrl: readString(albumRecord?.picUrl ?? albumRecord?.coverUrl) || undefined,
    alias: alias && alias.length > 0 ? alias : undefined,
    rawData: toJsonSafe(raw),
    createdAt: now,
    updatedAt: now
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function readString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function toJsonSafe(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return undefined
  }
}
