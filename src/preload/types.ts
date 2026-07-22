import type { IpcResult } from '../main/types/common'
import type { LoginQrResult, LoginStatusResult, QrStatusResult } from '../main/types/auth'
import type { UserProfile } from '../main/types/user'
import type { LikedSong, SyncLikedSongsResult } from '../main/types/song'
import type { ExportRecord, ExportRequestOptions, ExportResult } from '../main/types/export'
import type {
  MusicAnalysisDataset,
  MusicStatsSummary,
  StatisticsSource,
  StatisticsSourceInfo
} from '../main/types/statistics'
import type {
  Playlist,
  PlaylistType,
  SyncAllPlaylistSongsResult,
  SyncPlaylistSongsResult,
  SyncPlaylistsResult
} from '../main/types/playlist'
import type { PlaylistTrack } from '../main/types/song'
import type { PublicSettingKey, PublicSettings } from '../main/types/settings'
import type {
  BackupCreateResult,
  BackupRestoreResult,
  BackupRestoreSelection
} from '../main/types/backup'
import type { DiagnosticExportResult, DiagnosticSummary } from '../main/types/diagnostics'
import type {
  CreateLLMProfileRequest,
  JobRun,
  LLMJobIdRequest,
  LLMProfileIdRequest,
  LLMProtocolOption,
  PublicLLMProfile,
  SetLLMProfileApiKeyRequest,
  UpdateLLMProfileRequest
} from '../main/types/llm'

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
  playlists: {
    syncUserPlaylists: () => Promise<IpcResult<SyncPlaylistsResult>>
    getPlaylists: () => Promise<IpcResult<Playlist[]>>
    searchPlaylists: (keyword: string) => Promise<IpcResult<Playlist[]>>
    getPlaylistsByType: (type: PlaylistType) => Promise<IpcResult<Playlist[]>>
    getPlaylistById: (id: string) => Promise<IpcResult<Playlist | null>>
    clearPlaylistCache: () => Promise<IpcResult<void>>
    syncPlaylistSongs: (playlistId: string) => Promise<IpcResult<SyncPlaylistSongsResult>>
    syncAllPlaylistSongs: () => Promise<IpcResult<SyncAllPlaylistSongsResult>>
    getPlaylistSongs: (playlistId: string) => Promise<IpcResult<PlaylistTrack[]>>
    searchPlaylistSongs: (
      playlistId: string,
      keyword: string
    ) => Promise<IpcResult<PlaylistTrack[]>>
    clearPlaylistSongsCache: (playlistId: string) => Promise<IpcResult<void>>
  }
  export: {
    exportSongs: (options: ExportRequestOptions) => Promise<IpcResult<ExportResult>>
    exportLikedSongs: (options: ExportRequestOptions) => Promise<IpcResult<ExportResult>>
    exportPlaylistSongs: (
      playlistId: string,
      options: Omit<ExportRequestOptions, 'source'>
    ) => Promise<IpcResult<ExportResult>>
    exportCsv: (options: unknown) => Promise<IpcResult>
    exportJson: (options: unknown) => Promise<IpcResult>
    exportMarkdown: (options: unknown) => Promise<IpcResult>
    getExportRecords: () => Promise<IpcResult<ExportRecord[]>>
    openFile: (recordId: string) => Promise<IpcResult<void>>
    openFolder: (recordId: string) => Promise<IpcResult<void>>
    clearRecords: () => Promise<IpcResult<void>>
  }
  statistics: {
    getSummary: (source: StatisticsSource) => Promise<IpcResult<MusicStatsSummary>>
    getSources: () => Promise<IpcResult<StatisticsSourceInfo[]>>
    getAnalysisDataset: (source: StatisticsSource) => Promise<IpcResult<MusicAnalysisDataset>>
  }
  settings: {
    get: (key: PublicSettingKey) => Promise<IpcResult<string | null>>
    set: (key: PublicSettingKey, value: string) => Promise<IpcResult<void>>
    getAll: () => Promise<IpcResult<PublicSettings>>
    selectExportDirectory: () => Promise<IpcResult<string | null>>
    resetExportDirectory: () => Promise<IpcResult<void>>
  }
  backup: {
    create: () => Promise<IpcResult<BackupCreateResult | null>>
    selectForRestore: () => Promise<IpcResult<BackupRestoreSelection | null>>
    restore: (token: string) => Promise<IpcResult<BackupRestoreResult>>
  }
  diagnostics: {
    getSummary: () => Promise<IpcResult<DiagnosticSummary>>
    export: () => Promise<IpcResult<DiagnosticExportResult | null>>
  }
  llmProfiles: {
    list: () => Promise<IpcResult<PublicLLMProfile[]>>
    getActive: () => Promise<IpcResult<PublicLLMProfile | null>>
    getProtocolOptions: () => Promise<IpcResult<LLMProtocolOption[]>>
    create: (request: CreateLLMProfileRequest) => Promise<IpcResult<PublicLLMProfile>>
    update: (request: UpdateLLMProfileRequest) => Promise<IpcResult<PublicLLMProfile>>
    delete: (request: LLMProfileIdRequest) => Promise<IpcResult<boolean>>
    setActive: (request: LLMProfileIdRequest) => Promise<IpcResult<PublicLLMProfile>>
    setApiKey: (request: SetLLMProfileApiKeyRequest) => Promise<IpcResult<void>>
    deleteApiKey: (request: LLMProfileIdRequest) => Promise<IpcResult<void>>
    testConnection: (request: LLMProfileIdRequest) => Promise<IpcResult<JobRun>>
  }
  llmJobs: {
    list: () => Promise<IpcResult<JobRun[]>>
    get: (request: LLMJobIdRequest) => Promise<IpcResult<JobRun>>
    cancel: (request: LLMJobIdRequest) => Promise<IpcResult<boolean>>
  }
}
