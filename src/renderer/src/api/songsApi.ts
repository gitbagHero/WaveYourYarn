import { getPreloadApi } from './preloadClient'
import type { IpcResult } from '../../../main/types/common'
import type { LikedSong, SyncLikedSongsResult } from '../types/song'

export const songsApi = {
  syncLikedSongs: async () => unwrap(await getPreloadApi().songs.syncLikedSongs()),
  getLikedSongs: async () => unwrap(await getPreloadApi().songs.getLikedSongs()),
  searchLikedSongs: async (keyword: string) =>
    unwrap(await getPreloadApi().songs.searchLikedSongs(keyword)),
  clearLikedSongsCache: async () => unwrap(await getPreloadApi().songs.clearLikedSongsCache())
}

function unwrap<T>(result: IpcResult<T>): T {
  if (result.success) {
    return result.data as T
  }

  throw new Error(result.message ?? result.error ?? '歌曲数据操作失败')
}

export type { LikedSong, SyncLikedSongsResult }
