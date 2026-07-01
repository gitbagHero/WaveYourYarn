import { ipcMain } from 'electron'
import { NCM_NOT_LOGGED_IN_MESSAGE, SongService } from '../services/SongService'
import type { IpcResult } from '../types/common'
import { toErrorMessage } from '../utils/errors'

const songService = new SongService()

export function registerSongsIpc(): void {
  ipcMain.handle('songs:sync-liked-songs', async () =>
    toIpcResult(() => songService.syncLikedSongs(), '同步我喜欢的音乐失败')
  )

  ipcMain.handle('songs:get-liked-songs', async () =>
    toIpcResult(() => songService.getLikedSongs(), '读取本地歌曲缓存失败')
  )

  ipcMain.handle('songs:search-liked-songs', async (_event, keyword: unknown) => {
    if (typeof keyword !== 'string') {
      return {
        success: false,
        message: '搜索关键词格式不正确',
        error: 'INVALID_KEYWORD'
      } satisfies IpcResult
    }

    return toIpcResult(() => songService.searchLikedSongs(keyword), '搜索本地歌曲缓存失败')
  })

  ipcMain.handle('songs:clear-liked-songs-cache', async () =>
    toIpcResult(() => songService.clearLikedSongsCache(), '清空本地歌曲缓存失败')
  )
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
