import { PlaylistRepository } from '../db/repositories/PlaylistRepository'
import { SongRepository } from '../db/repositories/SongRepository'
import { NCMPlaylistService } from '../adapters/ncm/NCMPlaylistService'
import { NCMUserService } from '../adapters/ncm/NCMUserService'
import {
  extractPlaylistTrackIndex,
  mapNcmPlaylistToPlaylist,
  mapNcmSongToSong
} from '../adapters/ncm/mappers'
import { SettingsRepository } from '../db/repositories/SettingsRepository'
import { getDatabase } from '../db/database'
import { NCMSongService } from '../adapters/ncm/NCMSongService'
import type {
  Playlist,
  PlaylistType,
  SyncAllPlaylistSongsResult,
  SyncPlaylistSongsResult,
  SyncPlaylistsResult
} from '../types/playlist'
import type { PlaylistTrack, Song } from '../types/song'
import { logger } from '../utils/logger'
import { nowIso } from '../utils/time'
import { SecureStorageService } from './SecureStorageService'
import { NCM_NOT_LOGGED_IN_MESSAGE } from './SongService'

const NCM_COOKIE_KEY = 'ncm_cookie'
const PLAYLISTS_LAST_SYNCED_AT_KEY = 'playlists_last_synced_at'
const PLAYLISTS_LAST_SYNC_RESULT_KEY = 'playlists_last_sync_result'
const ALL_PLAYLIST_TRACKS_LAST_SYNC_RESULT_KEY = 'all_playlist_tracks_last_sync_result'

export class PlaylistService {
  private isSyncing = false
  private isSyncingAllPlaylistSongs = false
  private syncingPlaylistIds = new Set<string>()

  constructor(
    private readonly playlistRepository = new PlaylistRepository(),
    private readonly songRepository = new SongRepository(),
    private readonly settingsRepository = new SettingsRepository(),
    private readonly secureStorageService = new SecureStorageService(),
    private readonly ncmPlaylistService = new NCMPlaylistService(),
    private readonly ncmSongService = new NCMSongService(),
    private readonly db = getDatabase()
  ) {}

  getPlaylistCount(): number {
    return this.playlistRepository.count()
  }

  async syncUserPlaylists(): Promise<SyncPlaylistsResult> {
    if (this.isSyncing) {
      throw new Error('当前正在同步歌单，请稍候')
    }

    this.isSyncing = true

    try {
      logger.info('开始同步用户歌单')
      const cookie = await this.getStoredCookieOrThrow()
      const userService = new NCMUserService(async () => cookie)
      const currentUser = await userService.getCurrentUser()

      if (!currentUser?.userId) {
        throw new Error('网易云登录状态可能已过期，请重新登录后再试')
      }

      const rawPlaylists = await this.ncmPlaylistService.getUserPlaylists(currentUser.userId, cookie)
      const playlists = rawPlaylists.map((raw) => mapNcmPlaylistToPlaylist(raw, currentUser.userId))
      const syncedAt = nowIso()
      const result: SyncPlaylistsResult = {
        total: playlists.length,
        createdCount: playlists.filter((playlist) => playlist.type === 'created').length,
        subscribedCount: playlists.filter((playlist) => playlist.type === 'subscribed').length,
        likedCount: playlists.filter((playlist) => playlist.type === 'liked').length,
        unknownCount: playlists.filter((playlist) => playlist.type === 'unknown').length,
        syncedAt
      }

      const writeTransaction = this.db.transaction(() => {
        this.playlistRepository.upsertPlaylists(playlists)
        const realLikedPlaylist = this.playlistRepository.getLikedPlaylist(currentUser.userId)

        if (
          realLikedPlaylist &&
          realLikedPlaylist.ncmPlaylistId !== `liked:${currentUser.userId}`
        ) {
          this.playlistRepository.mergeSyntheticLikedPlaylist(
            currentUser.userId,
            realLikedPlaylist.id
          )
        }

        this.playlistRepository.removePlaylistsMissingFromSnapshot(
          playlists.map((playlist) => playlist.ncmPlaylistId),
          currentUser.userId
        )
        this.songRepository.deleteOrphanSongs()
        this.settingsRepository.set(PLAYLISTS_LAST_SYNCED_AT_KEY, syncedAt)
        this.settingsRepository.set(PLAYLISTS_LAST_SYNC_RESULT_KEY, JSON.stringify(result))
      })

      writeTransaction()
      logger.info('用户歌单同步完成', result)
      return result
    } catch (error) {
      logger.error('用户歌单同步失败', error)
      throw error
    } finally {
      this.isSyncing = false
    }
  }

  async getPlaylists(): Promise<Playlist[]> {
    return this.playlistRepository.findAll()
  }

  async searchPlaylists(keyword: string): Promise<Playlist[]> {
    return this.playlistRepository.search(keyword)
  }

  async getPlaylistsByType(type: PlaylistType): Promise<Playlist[]> {
    return this.playlistRepository.findByType(type)
  }

  async getPlaylistById(id: string): Promise<Playlist | null> {
    return this.playlistRepository.findById(id)
  }

  async clearPlaylistCache(): Promise<void> {
    const clearTransaction = this.db.transaction(() => {
      this.playlistRepository.clearNonLikedPlaylists()
      this.songRepository.deleteOrphanSongs()
      this.settingsRepository.remove(PLAYLISTS_LAST_SYNCED_AT_KEY)
      this.settingsRepository.remove(PLAYLISTS_LAST_SYNC_RESULT_KEY)
    })

    clearTransaction()
    logger.info('本地歌单缓存已清空')
  }

  async syncPlaylistSongs(playlistId: string): Promise<SyncPlaylistSongsResult> {
    if (this.syncingPlaylistIds.has(playlistId)) {
      throw new Error('当前歌单正在同步，请稍候')
    }

    this.syncingPlaylistIds.add(playlistId)

    try {
      const cookie = await this.getStoredCookieOrThrow()
      const playlist = this.playlistRepository.findById(playlistId)

      if (!playlist) {
        throw new Error('该歌单不存在，可能是本地歌单缓存已清空，请重新同步歌单列表')
      }

      logger.info('开始同步指定歌单歌曲', {
        playlistId,
        ncmPlaylistId: playlist.ncmPlaylistId
      })

      const playlistDetail = await this.ncmPlaylistService.getPlaylistDetail(playlist.ncmPlaylistId, cookie)
      const trackIndexItems = extractPlaylistTrackIndex(playlistDetail)

      if (trackIndexItems.length === 0) {
        throw new Error('当前歌单没有获取到歌曲列表')
      }

      const songIds = trackIndexItems.map((item) => item.ncmSongId)
      const rawSongs = await this.ncmSongService.getSongDetails(songIds, cookie)
      const detailMap = new Map(rawSongs.filter((raw) => raw.id).map((raw) => [String(raw.id), raw]))
      const songs = trackIndexItems
        .map((item) => {
          const detail = detailMap.get(item.ncmSongId)
          return detail ? mapNcmSongToSong(detail) : null
        })
        .filter((song): song is Song => Boolean(song))
      const syncedSongIds = new Set(songs.map((song) => song.ncmSongId))
      const failedSongIds = songIds.filter((songId) => !syncedSongIds.has(songId))
      const metaBySongId = new Map(trackIndexItems.map((item) => [item.ncmSongId, item]))
      const syncedAt = nowIso()
      const result: SyncPlaylistSongsResult = {
        playlistId,
        ncmPlaylistId: playlist.ncmPlaylistId,
        total: trackIndexItems.length,
        successCount: songs.length,
        failedCount: failedSongIds.length,
        failedSongIds,
        syncedAt,
        hasAddedAt: trackIndexItems.some((item) => item.addedAt)
      }

      const transaction = this.db.transaction(() => {
        this.songRepository.upsertSongs(songs)
        const persistedSongs = songs
          .map((song) => this.songRepository.findByNcmSongId(song.ncmSongId))
          .filter((song): song is Song => Boolean(song))

        this.playlistRepository.replacePlaylistSongs(
          playlistId,
          persistedSongs.map((song) => ({
            songId: song.id,
            orderIndex: metaBySongId.get(song.ncmSongId)?.orderIndex ?? Number.MAX_SAFE_INTEGER,
            addedAt: metaBySongId.get(song.ncmSongId)?.addedAt
          }))
        )
        this.playlistRepository.upsertPlaylist({
          ...playlist,
          trackCount: trackIndexItems.length,
          rawData: playlistDetail,
          updatedAt: syncedAt
        })
        this.settingsRepository.set(`playlist_tracks_last_synced_at:${playlistId}`, syncedAt)
        this.settingsRepository.set(`playlist_tracks_last_sync_result:${playlistId}`, JSON.stringify(result))
      })

      transaction()
      logger.info('指定歌单歌曲同步完成', {
        playlistId,
        total: result.total,
        successCount: result.successCount,
        failedCount: result.failedCount,
        hasAddedAt: result.hasAddedAt
      })
      return result
    } catch (error) {
      logger.error('指定歌单歌曲同步失败', error)
      throw error
    } finally {
      this.syncingPlaylistIds.delete(playlistId)
    }
  }

  async syncAllPlaylistSongs(): Promise<SyncAllPlaylistSongsResult> {
    if (this.isSyncingAllPlaylistSongs) {
      throw new Error('当前正在同步所有歌单歌曲，请稍候')
    }

    const playlists = this.playlistRepository.findAll()

    if (playlists.length === 0) {
      throw new Error('当前还没有同步歌单列表，请先同步歌单列表后再同步歌曲')
    }

    this.isSyncingAllPlaylistSongs = true

    try {
      logger.info('开始同步所有歌单歌曲', { playlistCount: playlists.length })
      const results: SyncPlaylistSongsResult[] = []
      const failedPlaylists: SyncAllPlaylistSongsResult['failedPlaylists'] = []

      for (const playlist of playlists) {
        try {
          const result = await this.syncPlaylistSongs(playlist.id)
          results.push(result)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          failedPlaylists.push({
            playlistId: playlist.id,
            ncmPlaylistId: playlist.ncmPlaylistId,
            name: playlist.name,
            message
          })
          logger.warn('单个歌单歌曲同步失败，继续同步剩余歌单', {
            playlistId: playlist.id,
            ncmPlaylistId: playlist.ncmPlaylistId,
            message
          })
        }
      }

      const syncedAt = nowIso()
      const result: SyncAllPlaylistSongsResult = {
        totalPlaylists: playlists.length,
        successPlaylistCount: results.length,
        failedPlaylistCount: failedPlaylists.length,
        totalTracks: results.reduce((sum, item) => sum + item.total, 0),
        successTrackCount: results.reduce((sum, item) => sum + item.successCount, 0),
        failedTrackCount: results.reduce((sum, item) => sum + item.failedCount, 0),
        failedPlaylists,
        syncedAt
      }

      this.settingsRepository.set(ALL_PLAYLIST_TRACKS_LAST_SYNC_RESULT_KEY, JSON.stringify(result))
      logger.info('所有歌单歌曲同步完成', {
        totalPlaylists: result.totalPlaylists,
        successPlaylistCount: result.successPlaylistCount,
        failedPlaylistCount: result.failedPlaylistCount,
        totalTracks: result.totalTracks,
        failedTrackCount: result.failedTrackCount
      })
      return result
    } finally {
      this.isSyncingAllPlaylistSongs = false
    }
  }

  async getPlaylistSongs(playlistId: string): Promise<PlaylistTrack[]> {
    return this.playlistRepository.getPlaylistSongs(playlistId)
  }

  async searchPlaylistSongs(playlistId: string, keyword: string): Promise<PlaylistTrack[]> {
    return this.playlistRepository.searchPlaylistSongs(playlistId, keyword)
  }

  async clearPlaylistSongsCache(playlistId: string): Promise<void> {
    const playlist = this.playlistRepository.findById(playlistId)

    if (!playlist) {
      throw new Error('该歌单不存在，可能是本地歌单缓存已清空，请重新同步歌单列表')
    }

    if (playlist.type === 'liked') {
      throw new Error('“我喜欢的音乐”的缓存请在“我喜欢的音乐”页面管理')
    }

    const clearTransaction = this.db.transaction(() => {
      this.playlistRepository.clearPlaylistSongs(playlistId)
      this.songRepository.deleteOrphanSongs()
      this.settingsRepository.remove(`playlist_tracks_last_synced_at:${playlistId}`)
      this.settingsRepository.remove(`playlist_tracks_last_sync_result:${playlistId}`)
    })

    clearTransaction()
    logger.info('指定歌单歌曲缓存已清空', { playlistId })
  }

  private async getStoredCookieOrThrow(): Promise<string> {
    const cookie = await this.secureStorageService.getSecret(NCM_COOKIE_KEY)

    if (!cookie) {
      throw new Error(NCM_NOT_LOGGED_IN_MESSAGE)
    }

    return cookie
  }
}
