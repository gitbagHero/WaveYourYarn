import { logger } from '../../utils/logger'
import { callNcmApi } from './ncmApi'
import type { NcmSongDetail } from './mappers'

const SONG_DETAIL_BATCH_SIZE = 200
const PLAYLIST_PAGE_SIZE = 100

export interface LikedTrackIndexItem {
  ncmSongId: string
  orderIndex: number
  likedAt?: number
  rawTrackId?: unknown
}

export class NCMSongService {
  async getLikedPlaylistId(userId: string, cookie: string): Promise<string> {
    const playlists: Record<string, unknown>[] = []

    for (let offset = 0; ; offset += PLAYLIST_PAGE_SIZE) {
      const response = await callNcmApi('user_playlist', {
        uid: userId,
        limit: PLAYLIST_PAGE_SIZE,
        offset,
        cookie,
        timestamp: Date.now()
      })
      const pagePlaylists = response.body?.playlist

      if (!Array.isArray(pagePlaylists)) {
        throw new Error('网易云用户歌单返回结构异常')
      }

      playlists.push(...(pagePlaylists as Record<string, unknown>[]))

      if (pagePlaylists.length < PLAYLIST_PAGE_SIZE || response.body?.more !== true) {
        break
      }
    }

    const likedPlaylist = playlists.find((playlist) => isLikedPlaylist(playlist, userId))

    if (!likedPlaylist?.id) {
      logger.warn('未识别到我喜欢的音乐歌单', {
        playlistCount: playlists.length,
        ownPlaylistSamples: playlists
          .filter((playlist) => isOwnPlaylist(playlist, userId))
          .slice(0, 5)
          .map((playlist) => ({
            id: playlist.id,
            name: playlist.name,
            specialType: playlist.specialType,
            subscribed: playlist.subscribed
          }))
      })
      throw new Error('无法识别“我喜欢的音乐”歌单，后续需要支持手动选择歌单')
    }

    logger.info('找到我喜欢的音乐歌单', { playlistId: String(likedPlaylist.id) })
    return String(likedPlaylist.id)
  }

  async getLikedPlaylistTrackIndex(
    playlistId: string,
    cookie: string
  ): Promise<LikedTrackIndexItem[]> {
    const response = await callNcmApi('playlist_detail', {
      id: playlistId,
      cookie,
      timestamp: Date.now()
    })
    const playlist = response.body?.playlist
    const trackIds =
      playlist && typeof playlist === 'object'
        ? (playlist as Record<string, unknown>).trackIds
        : undefined

    if (!Array.isArray(trackIds)) {
      throw new Error('网易云歌单详情 trackIds 返回结构异常')
    }

    const items = trackIds
      .map((trackId, index): LikedTrackIndexItem | null => {
        if (!trackId || typeof trackId !== 'object') {
          return null
        }

        const record = trackId as Record<string, unknown>
        const ncmSongId = record.id

        if (!ncmSongId) {
          return null
        }

        return {
          ncmSongId: String(ncmSongId),
          orderIndex: index,
          likedAt: normalizeTimestamp(record.at),
          rawTrackId: sanitizeTrackId(record)
        }
      })
      .filter((item): item is LikedTrackIndexItem => Boolean(item))
    const likedAtCount = items.filter((item) => item.likedAt).length

    logger.info('我喜欢的音乐 trackIds 获取完成', {
      count: items.length,
      likedAtCount,
      missingLikedAtCount: items.length - likedAtCount,
      sample: items.slice(0, 3).map((item) => ({
        id: item.ncmSongId,
        hasAt: Boolean(item.likedAt),
        at: item.likedAt ? '[timestamp]' : null
      }))
    })

    return items
  }

  async getLikedSongIds(userId: string, cookie: string): Promise<string[]> {
    const response = await callNcmApi('likelist', {
      uid: userId,
      cookie,
      timestamp: Date.now()
    })
    const ids = response.body?.ids

    if (!Array.isArray(ids)) {
      throw new Error('网易云喜欢歌曲列表返回结构异常')
    }

    return ids.map((id) => String(id)).filter(Boolean)
  }

  async getSongDetails(songIds: string[], cookie: string): Promise<NcmSongDetail[]> {
    if (songIds.length === 0) {
      return []
    }

    const batches = chunk(songIds, SONG_DETAIL_BATCH_SIZE)
    const songs: NcmSongDetail[] = []
    logger.info('开始批量获取歌曲详情', {
      total: songIds.length,
      batchCount: batches.length,
      batchSize: SONG_DETAIL_BATCH_SIZE
    })

    for (const [index, batch] of batches.entries()) {
      try {
        const response = await callNcmApi('song_detail', {
          ids: batch.join(','),
          cookie,
          timestamp: Date.now()
        })
        const batchSongs = response.body?.songs

        if (!Array.isArray(batchSongs)) {
          logger.warn('歌曲详情批次返回结构异常', { batchIndex: index + 1 })
          continue
        }

        songs.push(...(batchSongs as NcmSongDetail[]))
        logger.info('歌曲详情批次获取成功', {
          batchIndex: index + 1,
          requestCount: batch.length,
          successCount: batchSongs.length
        })
      } catch (error) {
        logger.warn('歌曲详情批次获取失败', {
          batchIndex: index + 1,
          requestCount: batch.length,
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return songs
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function isLikedPlaylist(playlist: Record<string, unknown>, userId: string): boolean {
  const name = typeof playlist.name === 'string' ? playlist.name.trim() : ''
  const specialType =
    typeof playlist.specialType === 'number'
      ? playlist.specialType
      : Number.parseInt(String(playlist.specialType ?? ''), 10)
  const hasLikedName =
    name === '我喜欢的音乐' ||
    name.endsWith('喜欢的音乐') ||
    name.includes('我喜欢的音乐')

  return isOwnPlaylist(playlist, userId) && playlist.subscribed !== true && (specialType === 5 || hasLikedName)
}

function isOwnPlaylist(playlist: Record<string, unknown>, userId: string): boolean {
  const creator = playlist.creator
  const creatorUserId =
    creator && typeof creator === 'object'
      ? (creator as Record<string, unknown>).userId
      : undefined

  return String(creatorUserId ?? playlist.userId ?? '') === userId
}

function normalizeTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined
  }

  return value < 10_000_000_000 ? value * 1000 : value
}

function sanitizeTrackId(trackId: Record<string, unknown>): Record<string, unknown> {
  return {
    id: trackId.id,
    v: trackId.v,
    t: trackId.t,
    at: trackId.at,
    uid: trackId.uid
  }
}
