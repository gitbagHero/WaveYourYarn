import { NCM_NOT_LOGGED_IN_MESSAGE, SongService } from '../services/SongService'
import type { IpcResult } from '../types/common'
import { toIpcResult } from './ipcResult'
import { registerIpcHandler } from './registerIpcHandler'

export function registerSongsIpc(): void {
  const songService = new SongService()

  registerIpcHandler('songs:sync-liked-songs', async () =>
    toNcmIpcResult(() => songService.syncLikedSongs(), '同步我喜欢的音乐失败')
  )

  registerIpcHandler('songs:get-liked-songs', async () =>
    toNcmIpcResult(() => songService.getLikedSongs(), '读取本地歌曲缓存失败')
  )

  registerIpcHandler('songs:search-liked-songs', async (_event, keyword: unknown) => {
    if (typeof keyword !== 'string') {
      return {
        success: false,
        message: '搜索关键词格式不正确',
        error: 'INVALID_KEYWORD'
      } satisfies IpcResult
    }

    return toNcmIpcResult(() => songService.searchLikedSongs(keyword), '搜索本地歌曲缓存失败')
  })

  registerIpcHandler('songs:clear-liked-songs-cache', async () =>
    toNcmIpcResult(() => songService.clearLikedSongsCache(), '清空本地歌曲缓存失败')
  )
}

function toNcmIpcResult<T>(
  operation: () => Promise<T>,
  fallbackMessage: string
): Promise<IpcResult<T>> {
  return toIpcResult(operation, fallbackMessage, {
    codeByMessage: { [NCM_NOT_LOGGED_IN_MESSAGE]: 'NCM_NOT_LOGGED_IN' }
  })
}
