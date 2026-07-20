import { PlaylistService } from '../services/PlaylistService'
import { NCM_NOT_LOGGED_IN_MESSAGE } from '../services/SongService'
import type { IpcResult } from '../types/common'
import type { PlaylistType } from '../types/playlist'
import { toIpcResult } from './ipcResult'
import { registerIpcHandler } from './registerIpcHandler'

const playlistTypes: PlaylistType[] = ['liked', 'created', 'subscribed', 'unknown']

export function registerPlaylistsIpc(): void {
  const playlistService = new PlaylistService()

  registerIpcHandler('playlists:sync-user-playlists', async () =>
    toNcmIpcResult(() => playlistService.syncUserPlaylists(), '同步歌单列表失败')
  )

  registerIpcHandler('playlists:get-playlists', async () =>
    toNcmIpcResult(() => playlistService.getPlaylists(), '读取本地歌单缓存失败')
  )

  registerIpcHandler('playlists:search-playlists', async (_event, keyword: unknown) => {
    if (typeof keyword !== 'string') {
      return {
        success: false,
        message: '搜索关键词格式不正确',
        error: 'INVALID_KEYWORD'
      } satisfies IpcResult
    }

    return toNcmIpcResult(() => playlistService.searchPlaylists(keyword), '搜索本地歌单缓存失败')
  })

  registerIpcHandler('playlists:get-playlists-by-type', async (_event, type: unknown) => {
    if (!playlistTypes.includes(type as PlaylistType)) {
      return {
        success: false,
        message: '歌单类型不正确',
        error: 'INVALID_PLAYLIST_TYPE'
      } satisfies IpcResult
    }

    return toNcmIpcResult(
      () => playlistService.getPlaylistsByType(type as PlaylistType),
      '读取歌单分类失败'
    )
  })

  registerIpcHandler('playlists:get-playlist-by-id', async (_event, id: unknown) => {
    if (typeof id !== 'string' || id.trim().length === 0) {
      return {
        success: false,
        message: '歌单 ID 不能为空',
        error: 'INVALID_PLAYLIST_ID'
      } satisfies IpcResult
    }

    return toNcmIpcResult(() => playlistService.getPlaylistById(id), '读取歌单详情失败')
  })

  registerIpcHandler('playlists:clear-playlist-cache', async () =>
    toNcmIpcResult(() => playlistService.clearPlaylistCache(), '清空歌单缓存失败')
  )

  registerIpcHandler('playlists:sync-playlist-songs', async (_event, playlistId: unknown) => {
    if (typeof playlistId !== 'string' || playlistId.trim().length === 0) {
      return invalidPlaylistIdResult()
    }

    return toNcmIpcResult(() => playlistService.syncPlaylistSongs(playlistId), '同步歌单歌曲失败')
  })

  registerIpcHandler('playlists:sync-all-playlist-songs', async () =>
    toNcmIpcResult(() => playlistService.syncAllPlaylistSongs(), '同步所有歌单歌曲失败')
  )

  registerIpcHandler('playlists:get-playlist-songs', async (_event, playlistId: unknown) => {
    if (typeof playlistId !== 'string' || playlistId.trim().length === 0) {
      return invalidPlaylistIdResult()
    }

    return toNcmIpcResult(
      () => playlistService.getPlaylistSongs(playlistId),
      '读取歌单歌曲缓存失败'
    )
  })

  registerIpcHandler('playlists:search-playlist-songs', async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return {
        success: false,
        message: '搜索参数格式不正确',
        error: 'INVALID_SEARCH_PAYLOAD'
      } satisfies IpcResult
    }

    const { playlistId, keyword } = payload as Record<string, unknown>

    if (typeof playlistId !== 'string' || playlistId.trim().length === 0) {
      return invalidPlaylistIdResult()
    }

    if (typeof keyword !== 'string') {
      return {
        success: false,
        message: '搜索关键词格式不正确',
        error: 'INVALID_KEYWORD'
      } satisfies IpcResult
    }

    return toNcmIpcResult(
      () => playlistService.searchPlaylistSongs(playlistId, keyword),
      '搜索歌单歌曲缓存失败'
    )
  })

  registerIpcHandler(
    'playlists:clear-playlist-songs-cache',
    async (_event, playlistId: unknown) => {
      if (typeof playlistId !== 'string' || playlistId.trim().length === 0) {
        return invalidPlaylistIdResult()
      }

      return toNcmIpcResult(
        () => playlistService.clearPlaylistSongsCache(playlistId),
        '清空歌单歌曲缓存失败'
      )
    }
  )
}

function invalidPlaylistIdResult(): IpcResult {
  return {
    success: false,
    message: '歌单 ID 不能为空',
    error: 'INVALID_PLAYLIST_ID'
  }
}

function toNcmIpcResult<T>(
  operation: () => Promise<T>,
  fallbackMessage: string
): Promise<IpcResult<T>> {
  return toIpcResult(operation, fallbackMessage, {
    codeByMessage: { [NCM_NOT_LOGGED_IN_MESSAGE]: 'NCM_NOT_LOGGED_IN' }
  })
}
