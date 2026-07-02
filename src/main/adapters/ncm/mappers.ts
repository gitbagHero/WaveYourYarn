import { nanoid } from 'nanoid'
import type { Playlist, PlaylistType } from '../../types/playlist'
import type { PlaylistTrack, Song } from '../../types/song'
import { nowIso } from '../../utils/time'

export type NcmSongDetail = Record<string, unknown>
export type NcmPlaylistRaw = Record<string, unknown>
export interface PlaylistTrackIndexItem {
  ncmSongId: string
  orderIndex: number
  addedAt?: number
  rawTrackId?: unknown
}

export function mapNcmPlaylistToPlaylist(raw: unknown, currentUserId: string): Playlist {
  const record = readRecord(raw)

  if (!record?.id) {
    throw new Error('网易云歌单数据结构异常')
  }

  const creator = readRecord(record.creator)
  const ownerUserId = readString(creator?.userId ?? record.userId) || undefined
  const specialType = readNumber(record.specialType)
  const subscribed = typeof record.subscribed === 'boolean' ? record.subscribed : undefined
  const name = readString(record.name) || '未命名歌单'
  const now = nowIso()

  return {
    id: nanoid(),
    ncmPlaylistId: String(record.id),
    name,
    description: readString(record.description) || undefined,
    coverUrl: readString(record.coverImgUrl ?? record.coverUrl) || undefined,
    trackCount: readNumber(record.trackCount),
    ownerUserId,
    ownerNickname: readString(creator?.nickname) || undefined,
    type: inferPlaylistType({ name, ownerUserId, currentUserId, subscribed, specialType }),
    subscribed,
    specialType,
    playCount: readNumber(record.playCount),
    updateTime: readNumber(record.updateTime),
    createTime: readNumber(record.createTime),
    rawData: toJsonSafe(raw),
    createdAt: now,
    updatedAt: now
  }
}

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

export function mapNcmSongToPlaylistTrack(
  raw: NcmSongDetail,
  meta: { playlistId: string; orderIndex: number; addedAt?: number }
): PlaylistTrack {
  return {
    ...mapNcmSongToSong(raw),
    playlistId: meta.playlistId,
    orderIndex: meta.orderIndex,
    addedAt: meta.addedAt
  }
}

export function extractPlaylistTrackIndex(rawPlaylistDetail: unknown): PlaylistTrackIndexItem[] {
  const playlist = readRecord(rawPlaylistDetail)
  const trackIds = playlist?.trackIds

  if (Array.isArray(trackIds) && trackIds.length > 0) {
    return trackIds
      .map((trackId, index): PlaylistTrackIndexItem | null => {
        const record = readRecord(trackId)

        if (!record?.id) {
          return null
        }

        return {
          ncmSongId: String(record.id),
          orderIndex: index,
          addedAt: normalizeTimestamp(record.at),
          rawTrackId: toJsonSafe(record)
        }
      })
      .filter((item): item is PlaylistTrackIndexItem => Boolean(item))
  }

  const tracks = playlist?.tracks

  if (Array.isArray(tracks) && tracks.length > 0) {
    return tracks
      .map((track, index): PlaylistTrackIndexItem | null => {
        const record = readRecord(track)

        if (!record?.id) {
          return null
        }

        return {
          ncmSongId: String(record.id),
          orderIndex: index,
          rawTrackId: toJsonSafe(record)
        }
      })
      .filter((item): item is PlaylistTrackIndexItem => Boolean(item))
  }

  return []
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

function normalizeTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined
  }

  return value < 10_000_000_000 ? value * 1000 : value
}

function inferPlaylistType({
  name,
  ownerUserId,
  currentUserId,
  subscribed,
  specialType
}: {
  name: string
  ownerUserId?: string
  currentUserId: string
  subscribed?: boolean
  specialType?: number
}): PlaylistType {
  if (specialType === 5) {
    return 'liked'
  }

  if (name.includes('喜欢的音乐') && ownerUserId === currentUserId) {
    return 'liked'
  }

  if (ownerUserId === currentUserId) {
    return 'created'
  }

  if (subscribed === true) {
    return 'subscribed'
  }

  if (ownerUserId && ownerUserId !== currentUserId) {
    return 'subscribed'
  }

  return 'unknown'
}

function toJsonSafe(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return undefined
  }
}
