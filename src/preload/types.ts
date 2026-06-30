import type { IpcResult } from '../main/types/common'
import type { LoginQrResult, LoginStatusResult, QrStatusResult } from '../main/types/auth'
import type { UserProfile } from '../main/types/user'

export interface WaveYourYarnApi {
  app: {
    getVersion: () => Promise<IpcResult<string>>
    ping: () => Promise<IpcResult<string>>
  }
  auth: {
    startWebLogin: () => Promise<IpcResult<void>>
    completeWebLogin: () => Promise<IpcResult<LoginStatusResult>>
    loginWithCookie: (cookie: string) => Promise<IpcResult<LoginStatusResult>>
    getLoginQr: () => Promise<IpcResult<LoginQrResult>>
    checkQrStatus: (key: string) => Promise<IpcResult<QrStatusResult>>
    getLoginStatus: () => Promise<IpcResult<LoginStatusResult>>
    getCurrentUser: () => Promise<IpcResult<UserProfile | null>>
    logout: () => Promise<IpcResult<void>>
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
