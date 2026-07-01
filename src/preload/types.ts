import type { IpcResult } from '../main/types/common'
import type { LoginQrResult, LoginStatusResult, QrStatusResult } from '../main/types/auth'
import type { UserProfile } from '../main/types/user'
import type { LikedSong, SyncLikedSongsResult } from '../main/types/song'

export interface WaveYourYarnApi {
  app: {
    getVersion: () => Promise<IpcResult<string>>
    ping: () => Promise<IpcResult<string>>
  }
  auth: {
    openWebLogin: () => Promise<IpcResult<LoginStatusResult>>
    startWebLogin: () => Promise<IpcResult<LoginStatusResult>>
    completeWebLogin: () => Promise<IpcResult<LoginStatusResult>>
    loginWithCookie: (cookie: string) => Promise<IpcResult<LoginStatusResult>>
    getLoginQr: () => Promise<IpcResult<LoginQrResult>>
    checkQrStatus: (key: string) => Promise<IpcResult<QrStatusResult>>
    getLoginStatus: () => Promise<IpcResult<LoginStatusResult>>
    getCurrentUser: () => Promise<IpcResult<UserProfile | null>>
    logout: () => Promise<IpcResult<void>>
    clearWebLoginSession: () => Promise<IpcResult<void>>
  }
  songs: {
    syncLikedSongs: () => Promise<IpcResult<SyncLikedSongsResult>>
    getLikedSongs: () => Promise<IpcResult<LikedSong[]>>
    searchLikedSongs: (keyword: string) => Promise<IpcResult<LikedSong[]>>
    clearLikedSongsCache: () => Promise<IpcResult<void>>
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
