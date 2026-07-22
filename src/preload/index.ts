import { contextBridge, ipcRenderer } from 'electron'
import type { WaveYourYarnApi } from './types'

const api: WaveYourYarnApi = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    ping: () => ipcRenderer.invoke('app:ping')
  },
  auth: {
    openWebLogin: () => ipcRenderer.invoke('auth:open-web-login'),
    startWebLogin: () => ipcRenderer.invoke('auth:start-web-login'),
    completeWebLogin: () => ipcRenderer.invoke('auth:complete-web-login'),
    loginWithCookie: (cookie: string) => ipcRenderer.invoke('auth:login-with-cookie', cookie),
    getLoginQr: () => ipcRenderer.invoke('auth:get-login-qr'),
    checkQrStatus: (key: string) => ipcRenderer.invoke('auth:check-qr-status', key),
    getLoginStatus: () => ipcRenderer.invoke('auth:get-login-status'),
    getCurrentUser: () => ipcRenderer.invoke('auth:get-current-user'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    clearWebLoginSession: () => ipcRenderer.invoke('auth:clear-web-login-session')
  },
  songs: {
    syncLikedSongs: () => ipcRenderer.invoke('songs:sync-liked-songs'),
    getLikedSongs: () => ipcRenderer.invoke('songs:get-liked-songs'),
    searchLikedSongs: (keyword: string) =>
      ipcRenderer.invoke('songs:search-liked-songs', typeof keyword === 'string' ? keyword : ''),
    clearLikedSongsCache: () => ipcRenderer.invoke('songs:clear-liked-songs-cache')
  },
  playlists: {
    syncUserPlaylists: () => ipcRenderer.invoke('playlists:sync-user-playlists'),
    getPlaylists: () => ipcRenderer.invoke('playlists:get-playlists'),
    searchPlaylists: (keyword: string) =>
      ipcRenderer.invoke('playlists:search-playlists', typeof keyword === 'string' ? keyword : ''),
    getPlaylistsByType: (type) => ipcRenderer.invoke('playlists:get-playlists-by-type', type),
    getPlaylistById: (id: string) =>
      ipcRenderer.invoke('playlists:get-playlist-by-id', typeof id === 'string' ? id : ''),
    clearPlaylistCache: () => ipcRenderer.invoke('playlists:clear-playlist-cache'),
    syncPlaylistSongs: (playlistId: string) =>
      ipcRenderer.invoke('playlists:sync-playlist-songs', typeof playlistId === 'string' ? playlistId : ''),
    syncAllPlaylistSongs: () => ipcRenderer.invoke('playlists:sync-all-playlist-songs'),
    getPlaylistSongs: (playlistId: string) =>
      ipcRenderer.invoke('playlists:get-playlist-songs', typeof playlistId === 'string' ? playlistId : ''),
    searchPlaylistSongs: (playlistId: string, keyword: string) =>
      ipcRenderer.invoke('playlists:search-playlist-songs', {
        playlistId: typeof playlistId === 'string' ? playlistId : '',
        keyword: typeof keyword === 'string' ? keyword : ''
      }),
    clearPlaylistSongsCache: (playlistId: string) =>
      ipcRenderer.invoke('playlists:clear-playlist-songs-cache', typeof playlistId === 'string' ? playlistId : '')
  },
  export: {
    exportSongs: (options) => ipcRenderer.invoke('export:songs', options),
    exportLikedSongs: (options) => ipcRenderer.invoke('export:liked-songs', options),
    exportPlaylistSongs: (playlistId, options) =>
      ipcRenderer.invoke('export:playlist-songs', {
        ...(options && typeof options === 'object' ? options : {}),
        playlistId: typeof playlistId === 'string' ? playlistId : ''
      }),
    exportCsv: (options: unknown) => ipcRenderer.invoke('export:csv', options),
    exportJson: (options: unknown) => ipcRenderer.invoke('export:json', options),
    exportMarkdown: (options: unknown) => ipcRenderer.invoke('export:markdown', options),
    getExportRecords: () => ipcRenderer.invoke('export:get-records'),
    openFile: (recordId: string) =>
      ipcRenderer.invoke('export:open-file', typeof recordId === 'string' ? recordId : ''),
    openFolder: (recordId: string) =>
      ipcRenderer.invoke('export:open-folder', typeof recordId === 'string' ? recordId : ''),
    clearRecords: () => ipcRenderer.invoke('export:clear-records')
  },
  statistics: {
    getSummary: (source) => ipcRenderer.invoke('statistics:get-summary', source),
    getSources: () => ipcRenderer.invoke('statistics:get-sources'),
    getAnalysisDataset: (source) => ipcRenderer.invoke('statistics:get-analysis-dataset', source)
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    selectExportDirectory: () => ipcRenderer.invoke('settings:select-export-directory'),
    resetExportDirectory: () => ipcRenderer.invoke('settings:reset-export-directory')
  },
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    selectForRestore: () => ipcRenderer.invoke('backup:select-for-restore'),
    restore: (token: string) =>
      ipcRenderer.invoke('backup:restore', typeof token === 'string' ? token : '')
  },
  diagnostics: {
    getSummary: () => ipcRenderer.invoke('diagnostics:get-summary'),
    export: () => ipcRenderer.invoke('diagnostics:export')
  },
  llmProfiles: {
    list: () => ipcRenderer.invoke('llm-profiles:list'),
    getActive: () => ipcRenderer.invoke('llm-profiles:get-active'),
    getProtocolOptions: () => ipcRenderer.invoke('llm-profiles:get-protocol-options'),
    create: (request) => ipcRenderer.invoke('llm-profiles:create', request),
    update: (request) => ipcRenderer.invoke('llm-profiles:update', request),
    delete: (request) => ipcRenderer.invoke('llm-profiles:delete', request),
    setActive: (request) => ipcRenderer.invoke('llm-profiles:set-active', request),
    setApiKey: (request) => ipcRenderer.invoke('llm-profiles:set-api-key', request),
    deleteApiKey: (request) => ipcRenderer.invoke('llm-profiles:delete-api-key', request),
    testConnection: (request) => ipcRenderer.invoke('llm-profiles:test-connection', request)
  },
  llmJobs: {
    list: () => ipcRenderer.invoke('llm-jobs:list'),
    get: (request) => ipcRenderer.invoke('llm-jobs:get', request),
    cancel: (request) => ipcRenderer.invoke('llm-jobs:cancel', request)
  }
}

contextBridge.exposeInMainWorld('waveYourYarn', api)
