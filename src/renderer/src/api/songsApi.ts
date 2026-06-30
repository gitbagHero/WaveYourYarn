import { getPreloadApi } from './preloadClient'

export const songsApi = {
  syncLikedSongs: () => getPreloadApi().songs.syncLikedSongs(),
  getLikedSongs: () => getPreloadApi().songs.getLikedSongs(),
  searchLikedSongs: (keyword: string) => getPreloadApi().songs.searchLikedSongs(keyword)
}
