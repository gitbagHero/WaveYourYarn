import { getDatabase } from '../db/database'
import { ExportRecordRepository } from '../db/repositories/ExportRecordRepository'
import { PlaylistRepository } from '../db/repositories/PlaylistRepository'
import { SettingsRepository } from '../db/repositories/SettingsRepository'
import { SongRepository } from '../db/repositories/SongRepository'
import { UserRepository } from '../db/repositories/UserRepository'
import { logger } from '../utils/logger'

export const CACHE_OWNER_NCM_USER_ID_KEY = 'cache_owner_ncm_user_id'

const SYNC_SETTING_PREFIXES = [
  'liked_songs_last_',
  'playlists_last_',
  'playlist_tracks_last_',
  'all_playlist_tracks_last_'
]

export interface CacheOwnershipResult {
  cacheReset: boolean
}

export class CacheOwnershipService {
  constructor(
    private readonly settingsRepository = new SettingsRepository(),
    private readonly playlistRepository = new PlaylistRepository(),
    private readonly songRepository = new SongRepository(),
    private readonly exportRecordRepository = new ExportRecordRepository(),
    private readonly userRepository = new UserRepository(),
    private readonly db = getDatabase()
  ) {}

  getOwnerUserId(): string | null {
    return this.settingsRepository.get(CACHE_OWNER_NCM_USER_ID_KEY)
  }

  ensureOwner(ncmUserId: string): CacheOwnershipResult {
    const recordedOwner = this.getOwnerUserId()
    const inferredOwner = recordedOwner ? null : this.inferLegacyCacheOwner()
    const currentOwner = recordedOwner ?? inferredOwner

    if (!currentOwner) {
      if (this.hasAccountScopedData()) {
        this.resetForOwner(ncmUserId)
        logger.info('旧版本缓存归属无法确认，已在登录时安全清理', {
          currentUserId: ncmUserId
        })
        return { cacheReset: true }
      }

      this.settingsRepository.set(CACHE_OWNER_NCM_USER_ID_KEY, ncmUserId)
      return { cacheReset: false }
    }

    if (!recordedOwner) {
      this.settingsRepository.set(CACHE_OWNER_NCM_USER_ID_KEY, currentOwner)
    }

    if (currentOwner === ncmUserId) {
      return { cacheReset: false }
    }

    this.resetForOwner(ncmUserId)
    logger.info('检测到网易云账号切换，旧账号本地缓存已清理', {
      previousUserId: currentOwner,
      currentUserId: ncmUserId
    })
    return { cacheReset: true }
  }

  private inferLegacyCacheOwner(): string | null {
    const playlists = this.playlistRepository.findAll()
    const likedOwners = new Set(
      playlists
        .filter((playlist) => playlist.type === 'liked' && playlist.ownerUserId)
        .map((playlist) => playlist.ownerUserId as string)
    )

    if (likedOwners.size === 1) {
      return [...likedOwners][0]
    }

    const createdOwners = new Set(
      playlists
        .filter((playlist) => playlist.type === 'created' && playlist.ownerUserId)
        .map((playlist) => playlist.ownerUserId as string)
    )

    return createdOwners.size === 1 ? [...createdOwners][0] : null
  }

  private hasAccountScopedData(): boolean {
    return (
      this.playlistRepository.count() > 0 ||
      this.songRepository.count() > 0 ||
      this.exportRecordRepository.count() > 0
    )
  }

  private resetForOwner(ncmUserId: string): void {
    const reset = this.db.transaction(() => {
      this.playlistRepository.clearAllPlaylists()
      this.songRepository.clearAllSongs()
      this.exportRecordRepository.clearAll()
      this.userRepository.clearExceptNcmUserId(ncmUserId)
      this.settingsRepository.removeByPrefixes(SYNC_SETTING_PREFIXES)
      this.settingsRepository.set(CACHE_OWNER_NCM_USER_ID_KEY, ncmUserId)
    })

    reset()
  }
}
