import { contextBridge, ipcRenderer } from 'electron'
import type { WaveYourYarnApi } from './types'

const api: WaveYourYarnApi = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    ping: () => ipcRenderer.invoke('app:ping')
  },
  auth: {
    getLoginStatus: () => ipcRenderer.invoke('auth:get-login-status'),
    getCurrentUser: () => ipcRenderer.invoke('auth:get-current-user'),
    logout: () => ipcRenderer.invoke('auth:logout')
  },
  songs: {
    syncLikedSongs: () => ipcRenderer.invoke('songs:sync-liked-songs'),
    getLikedSongs: () => ipcRenderer.invoke('songs:get-liked-songs'),
    searchLikedSongs: (keyword: string) => ipcRenderer.invoke('songs:search-liked-songs', keyword)
  },
  export: {
    exportCsv: (options: unknown) => ipcRenderer.invoke('export:csv', options),
    exportJson: (options: unknown) => ipcRenderer.invoke('export:json', options),
    exportMarkdown: (options: unknown) => ipcRenderer.invoke('export:markdown', options),
    getExportRecords: () => ipcRenderer.invoke('export:get-records')
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:get-all')
  }
}

contextBridge.exposeInMainWorld('waveYourYarn', api)
