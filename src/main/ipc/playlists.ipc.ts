import { ipcMain } from 'electron'
import { PlaylistService } from '../services/PlaylistService'
import { NCM_NOT_LOGGED_IN_MESSAGE } from '../services/SongService'
import type { IpcResult } from '../types/common'
import type { PlaylistType } from '../types/playlist'
import { toErrorMessage } from '../utils/errors'

const playlistService = new PlaylistService()
const playlistTypes: PlaylistType[] = ['liked', 'created', 'subscribed', 'unknown']

export function registerPlaylistsIpc(): void {
  ipcMain.handle('playlists:sync-user-playlists', async () =>
    toIpcResult(() => playlistService.syncUserPlaylists(), '同步歌单列表失败')
  )

  ipcMain.handle('playlists:get-playlists', async () =>
    toIpcResult(() => playlistService.getPlaylists(), '读取本地歌单缓存失败')
  )

  ipcMain.handle('playlists:search-playlists', async (_event, keyword: unknown) => {
    if (typeof keyword !== 'string') {
      return {
        success: false,
        message: '搜索关键词格式不正确',
        error: 'INVALID_KEYWORD'
      } satisfies IpcResult
    }

    return toIpcResult(() => playlistService.searchPlaylists(keyword), '搜索本地歌单缓存失败')
  })

  ipcMain.handle('playlists:get-playlists-by-type', async (_event, type: unknown) => {
    if (!playlistTypes.includes(type as PlaylistType)) {
      return {
        success: false,
        message: '歌单类型不正确',
        error: 'INVALID_PLAYLIST_TYPE'
      } satisfies IpcResult
    }

    return toIpcResult(
      () => playlistService.getPlaylistsByType(type as PlaylistType),
      '读取歌单分类失败'
    )
  })

  ipcMain.handle('playlists:get-playlist-by-id', async (_event, id: unknown) => {
    if (typeof id !== 'string' || id.trim().length === 0) {
      return {
        success: false,
        message: '歌单 ID 不能为空',
        error: 'INVALID_PLAYLIST_ID'
      } satisfies IpcResult
    }

    return toIpcResult(() => playlistService.getPlaylistById(id), '读取歌单详情失败')
  })

  ipcMain.handle('playlists:clear-playlist-cache', async () =>
    toIpcResult(() => playlistService.clearPlaylistCache(), '清空歌单缓存失败')
  )

  ipcMain.handle('playlists:sync-playlist-songs', async (_event, playlistId: unknown) => {
    if (typeof playlistId !== 'string' || playlistId.trim().length === 0) {
      return invalidPlaylistIdResult()
    }

    return toIpcResult(() => playlistService.syncPlaylistSongs(playlistId), '同步歌单歌曲失败')
  })

  ipcMain.handle('playlists:sync-all-playlist-songs', async () =>
    toIpcResult(() => playlistService.syncAllPlaylistSongs(), '同步所有歌单歌曲失败')
  )

  ipcMain.handle('playlists:get-playlist-songs', async (_event, playlistId: unknown) => {
    if (typeof playlistId !== 'string' || playlistId.trim().length === 0) {
      return invalidPlaylistIdResult()
    }

    return toIpcResult(() => playlistService.getPlaylistSongs(playlistId), '读取歌单歌曲缓存失败')
  })

  ipcMain.handle('playlists:search-playlist-songs', async (_event, payload: unknown) => {
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

    return toIpcResult(
      () => playlistService.searchPlaylistSongs(playlistId, keyword),
      '搜索歌单歌曲缓存失败'
    )
  })

  ipcMain.handle('playlists:clear-playlist-songs-cache', async (_event, playlistId: unknown) => {
    if (typeof playlistId !== 'string' || playlistId.trim().length === 0) {
      return invalidPlaylistIdResult()
    }

    return toIpcResult(() => playlistService.clearPlaylistSongsCache(playlistId), '清空歌单歌曲缓存失败')
  })
}

function invalidPlaylistIdResult(): IpcResult {
  return {
    success: false,
    message: '歌单 ID 不能为空',
    error: 'INVALID_PLAYLIST_ID'
  }
}

async function toIpcResult<T>(operation: () => Promise<T>, fallbackMessage: string): Promise<IpcResult<T>> {
  try {
    return {
      success: true,
      data: await operation()
    }
  } catch (error) {
    const errorMessage = toErrorMessage(error)

    if (errorMessage === NCM_NOT_LOGGED_IN_MESSAGE) {
      return {
        success: false,
        message: NCM_NOT_LOGGED_IN_MESSAGE,
        error: 'NCM_NOT_LOGGED_IN'
      }
    }

    return {
      success: false,
      message: fallbackMessage,
      error: errorMessage
    }
  }
}
