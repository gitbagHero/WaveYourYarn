import type { IpcResult } from '../../../main/types/common'
import type { WaveYourYarnApi } from '../../../preload/types'

function unavailable<T = unknown>(message = 'Electron preload API is unavailable.'): Promise<IpcResult<T>> {
  return Promise.resolve({
    success: false,
    message
  })
}

const browserFallbackApi: WaveYourYarnApi = {
  app: {
    getVersion: () => Promise.resolve({ success: true, data: '0.1.0-browser-preview' }),
    ping: () => Promise.resolve({ success: true, data: 'browser-preview' })
  },
  auth: {
    openWebLogin: () => unavailable(),
    startWebLogin: () => unavailable(),
    completeWebLogin: () => unavailable(),
    loginWithCookie: () => unavailable(),
    getLoginQr: () => unavailable(),
    checkQrStatus: () => unavailable(),
    getLoginStatus: () => unavailable(),
    getCurrentUser: () => unavailable(),
    logout: () => unavailable(),
    clearWebLoginSession: () => unavailable()
  },
  songs: {
    syncLikedSongs: () => unavailable(),
    getLikedSongs: () => unavailable(),
    searchLikedSongs: () => unavailable(),
    clearLikedSongsCache: () => unavailable()
  },
  playlists: {
    syncUserPlaylists: () => unavailable(),
    getPlaylists: () => unavailable(),
    searchPlaylists: () => unavailable(),
    getPlaylistsByType: () => unavailable(),
    getPlaylistById: () => unavailable(),
    clearPlaylistCache: () => unavailable(),
    syncPlaylistSongs: () => unavailable(),
    syncAllPlaylistSongs: () => unavailable(),
    getPlaylistSongs: () => unavailable(),
    searchPlaylistSongs: () => unavailable(),
    clearPlaylistSongsCache: () => unavailable()
  },
  export: {
    exportSongs: () => unavailable(),
    exportLikedSongs: () => unavailable(),
    exportPlaylistSongs: () => unavailable(),
    exportCsv: () => unavailable(),
    exportJson: () => unavailable(),
    exportMarkdown: () => unavailable(),
    getExportRecords: () => unavailable(),
    openFile: () => unavailable(),
    openFolder: () => unavailable(),
    clearRecords: () => unavailable()
  },
  settings: {
    get: () => unavailable(),
    set: () => unavailable(),
    getAll: () => unavailable()
  }
}

export function getPreloadApi(): WaveYourYarnApi {
  return window.waveYourYarn ?? browserFallbackApi
}
