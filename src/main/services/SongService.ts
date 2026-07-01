import { SongRepository } from '../db/repositories/SongRepository'
import { PlaylistRepository } from '../db/repositories/PlaylistRepository'
import { SettingsRepository } from '../db/repositories/SettingsRepository'
import { getDatabase } from '../db/database'
import { NCMSongService, type LikedTrackIndexItem } from '../adapters/ncm/NCMSongService'
import { NCMUserService } from '../adapters/ncm/NCMUserService'
import { mapNcmSongToSong } from '../adapters/ncm/mappers'
import type { LikedSong, Song, SyncLikedSongsResult } from '../types/song'
import { logger } from '../utils/logger'
import { nowIso } from '../utils/time'
import { SecureStorageService } from './SecureStorageService'

const NCM_COOKIE_KEY = 'ncm_cookie'
const NCM_USER_ID_KEY = 'ncm_user_id'
const LAST_SYNCED_AT_KEY = 'liked_songs_last_synced_at'
const LAST_SYNC_RESULT_KEY = 'liked_songs_last_sync_result'
export const NCM_NOT_LOGGED_IN_MESSAGE = '当前未连接网易云音乐，请先登录后再同步'

export class SongService {
  private isSyncing = false

  constructor(
    private readonly songRepository = new SongRepository(),
    private readonly playlistRepository = new PlaylistRepository(),
    private readonly settingsRepository = new SettingsRepository(),
    private readonly secureStorageService = new SecureStorageService(),
    private readonly ncmSongService = new NCMSongService(),
    private readonly db = getDatabase()
  ) {}

  getLikedSongsCount(): number {
    return this.songRepository.count()
  }

  async syncLikedSongs(): Promise<SyncLikedSongsResult> {
    if (this.isSyncing) {
      throw new Error('当前正在同步，请稍候')
    }

    this.isSyncing = true

    try {
      logger.info('开始同步我喜欢的音乐')
      const cookie = await this.getStoredCookieOrThrow()
      const userService = new NCMUserService(async () => cookie)
      const currentUser = await userService.getCurrentUser()

      if (!currentUser?.userId) {
        throw new Error('网易云登录状态可能已过期，请重新登录后再试')
      }

      logger.info('当前网易云用户', { userId: currentUser.userId })
      const trackIndexResult = await this.getLikedTrackIndex(currentUser.userId, cookie)
      const likedSongIds = trackIndexResult.items.map((item) => item.ncmSongId)
      logger.info('喜欢歌曲索引获取完成', {
        count: likedSongIds.length,
        source: trackIndexResult.source
      })

      const rawSongs = await this.ncmSongService.getSongDetails(likedSongIds, cookie)
      const detailMap = new Map(rawSongs.filter((raw) => raw.id).map((raw) => [String(raw.id), raw]))
      const songs = trackIndexResult.items
        .map((item) => {
          const detail = detailMap.get(item.ncmSongId)
          return detail ? mapNcmSongToSong(detail) : null
        })
        .filter((song): song is Song => Boolean(song))
      const syncedSongIds = new Set(songs.map((song) => song.ncmSongId))
      const failedSongIds = likedSongIds.filter((songId) => !syncedSongIds.has(songId))
      const syncedAt = nowIso()
      const likedAtCount = trackIndexResult.items.filter((item) => item.likedAt).length
      const result: SyncLikedSongsResult = {
        total: likedSongIds.length,
        successCount: songs.length,
        failedCount: failedSongIds.length,
        failedSongIds,
        syncedAt,
        hasLikedAt: likedAtCount > 0,
        source: trackIndexResult.source
      }

      logger.info('开始写入歌曲缓存', {
        total: result.total,
        successCount: result.successCount,
        failedCount: result.failedCount
      })

      const writeTransaction = this.db.transaction(() => {
        this.songRepository.upsertSongs(songs)
        const playlist = this.playlistRepository.upsertLikedPlaylist(currentUser.userId, likedSongIds.length)
        const persistedSongs = songs
          .map((song) => this.songRepository.findByNcmSongId(song.ncmSongId))
          .filter((song): song is Song => Boolean(song))

        this.playlistRepository.replacePlaylistSongs(
          playlist.id,
          persistedSongs.map((song) => ({
            songId: song.id,
            orderIndex: trackIndexResult.metaBySongId.get(song.ncmSongId)?.orderIndex ?? Number.MAX_SAFE_INTEGER,
            addedAt: trackIndexResult.metaBySongId.get(song.ncmSongId)?.likedAt
          }))
        )
        this.settingsRepository.set(LAST_SYNCED_AT_KEY, syncedAt)
        this.settingsRepository.set(LAST_SYNC_RESULT_KEY, JSON.stringify(result))
      })

      writeTransaction()
      logger.info('我喜欢的音乐同步完成', result)
      return result
    } catch (error) {
      logger.error('我喜欢的音乐同步失败', error)
      throw error
    } finally {
      this.isSyncing = false
    }
  }

  async getLikedSongs(): Promise<LikedSong[]> {
    const userId = await this.secureStorageService.getSecret(NCM_USER_ID_KEY)

    if (userId) {
      return this.playlistRepository.getLikedSongsWithMeta(userId)
    }

    return this.songRepository.findAll().map((song, index) => ({
      ...song,
      orderIndex: index
    }))
  }

  async searchLikedSongs(keyword: string): Promise<LikedSong[]> {
    const trimmed = keyword.trim()
    const songs = await this.getLikedSongs()

    if (!trimmed) {
      return songs
    }

    const lowerKeyword = trimmed.toLowerCase()
    return songs.filter((song) => {
      return (
        song.name.toLowerCase().includes(lowerKeyword) ||
        song.album?.toLowerCase().includes(lowerKeyword) ||
        song.artists.some((artist) => artist.toLowerCase().includes(lowerKeyword))
      )
    })
  }

  async clearLikedSongsCache(): Promise<void> {
    const clearTransaction = this.db.transaction(() => {
      this.playlistRepository.clearLikedPlaylists()
      this.songRepository.clearAll()
      this.settingsRepository.remove(LAST_SYNCED_AT_KEY)
      this.settingsRepository.remove(LAST_SYNC_RESULT_KEY)
    })

    clearTransaction()
    logger.info('我喜欢的音乐本地缓存已清空')
  }

  private async getStoredCookieOrThrow(): Promise<string> {
    const cookie = await this.secureStorageService.getSecret(NCM_COOKIE_KEY)

    if (!cookie) {
      throw new Error(NCM_NOT_LOGGED_IN_MESSAGE)
    }

    return cookie
  }

  private async getLikedTrackIndex(
    userId: string,
    cookie: string
  ): Promise<{
    items: LikedTrackIndexItem[]
    metaBySongId: Map<string, LikedTrackIndexItem>
    source: SyncLikedSongsResult['source']
  }> {
    try {
      const playlistId = await this.ncmSongService.getLikedPlaylistId(userId, cookie)
      const items = await this.ncmSongService.getLikedPlaylistTrackIndex(playlistId, cookie)
      return {
        items,
        metaBySongId: new Map(items.map((item) => [item.ncmSongId, item])),
        source: 'playlist_detail'
      }
    } catch (error) {
      logger.warn('playlist_detail 获取失败，回退到 likelist 同步', error)
      const songIds = await this.ncmSongService.getLikedSongIds(userId, cookie)
      const items = songIds.map((songId, index) => ({
        ncmSongId: songId,
        orderIndex: index
      }))

      return {
        items,
        metaBySongId: new Map(items.map((item) => [item.ncmSongId, item])),
        source: 'likelist_fallback'
      }
    }
  }
}
