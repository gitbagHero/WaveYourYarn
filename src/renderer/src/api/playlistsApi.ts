import type { IpcResult } from '../../../main/types/common'
import { getPreloadApi } from './preloadClient'
import type {
  Playlist,
  PlaylistType,
  SyncAllPlaylistSongsResult,
  SyncPlaylistSongsResult,
  SyncPlaylistsResult
} from '../types/playlist'
import type { PlaylistTrack } from '../types/song'

export const playlistsApi = {
  syncUserPlaylists: async () => unwrap(await getPreloadApi().playlists.syncUserPlaylists()),
  getPlaylists: async () => unwrap(await getPreloadApi().playlists.getPlaylists()),
  searchPlaylists: async (keyword: string) =>
    unwrap(await getPreloadApi().playlists.searchPlaylists(keyword)),
  getPlaylistsByType: async (type: PlaylistType) =>
    unwrap(await getPreloadApi().playlists.getPlaylistsByType(type)),
  getPlaylistById: async (id: string) => unwrap(await getPreloadApi().playlists.getPlaylistById(id)),
  clearPlaylistCache: async () => unwrap(await getPreloadApi().playlists.clearPlaylistCache()),
  syncPlaylistSongs: async (playlistId: string) =>
    unwrap(await getPreloadApi().playlists.syncPlaylistSongs(playlistId)),
  syncAllPlaylistSongs: async () =>
    unwrap(await getPreloadApi().playlists.syncAllPlaylistSongs()),
  getPlaylistSongs: async (playlistId: string) =>
    unwrap(await getPreloadApi().playlists.getPlaylistSongs(playlistId)),
  searchPlaylistSongs: async (playlistId: string, keyword: string) =>
    unwrap(await getPreloadApi().playlists.searchPlaylistSongs(playlistId, keyword)),
  clearPlaylistSongsCache: async (playlistId: string) =>
    unwrap(await getPreloadApi().playlists.clearPlaylistSongsCache(playlistId))
}

function unwrap<T>(result: IpcResult<T>): T {
  if (result.success) {
    return result.data as T
  }

  throw new Error(result.message ?? result.error ?? '歌单操作失败')
}

export type {
  Playlist,
  PlaylistTrack,
  PlaylistType,
  SyncAllPlaylistSongsResult,
  SyncPlaylistSongsResult,
  SyncPlaylistsResult
}
