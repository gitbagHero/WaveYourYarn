import type { IpcResult } from '../main/types/common'

export interface WaveYourYarnApi {
  app: {
    getVersion: () => Promise<IpcResult<string>>
    ping: () => Promise<IpcResult<string>>
  }
  auth: {
    getLoginStatus: () => Promise<IpcResult>
    getCurrentUser: () => Promise<IpcResult>
    logout: () => Promise<IpcResult>
  }
  songs: {
    syncLikedSongs: () => Promise<IpcResult>
    getLikedSongs: () => Promise<IpcResult>
    searchLikedSongs: (keyword: string) => Promise<IpcResult>
  }
  export: {
    exportCsv: (options: unknown) => Promise<IpcResult>
    exportJson: (options: unknown) => Promise<IpcResult>
    exportMarkdown: (options: unknown) => Promise<IpcResult>
    getExportRecords: () => Promise<IpcResult>
  }
  settings: {
    get: (key: string) => Promise<IpcResult>
    set: (key: string, value: string) => Promise<IpcResult>
    getAll: () => Promise<IpcResult>
  }
}
