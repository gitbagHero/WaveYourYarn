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
    getLoginStatus: () => unavailable(),
    getCurrentUser: () => unavailable(),
    logout: () => unavailable()
  },
  songs: {
    syncLikedSongs: () => unavailable(),
    getLikedSongs: () => unavailable(),
    searchLikedSongs: () => unavailable()
  },
  export: {
    exportCsv: () => unavailable(),
    exportJson: () => unavailable(),
    exportMarkdown: () => unavailable(),
    getExportRecords: () => unavailable()
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
