export interface DiagnosticDatabaseCounts {
  users: number
  songs: number
  playlists: number
  playlistSongs: number
  exportRecords: number
  publicSettings: number
}

export interface DiagnosticSummary {
  generatedAt: string
  application: {
    version: string
    electronVersion: string
    chromiumVersion: string
    nodeVersion: string
    platform: string
    architecture: string
    locale: string
  }
  database: {
    schemaVersion: number
    sizeBytes: number
    integrity: 'ok' | 'failed'
    counts: DiagnosticDatabaseCounts
  }
  storage: {
    appDataDirectoryAvailable: boolean
    databaseFileAvailable: boolean
    logFileAvailable: boolean
    safeStorageAvailable: boolean
  }
  adapters: {
    netease: { packageName: string; version: string }
    llm: { status: 'not-configured' }
    appleMusic: { status: 'not-configured' }
  }
}

export interface DiagnosticExportResult {
  fileName: string
  generatedAt: string
}

export interface DiagnosticRuntimeInfo {
  appVersion: string
  electronVersion: string
  chromiumVersion: string
  nodeVersion: string
  platform: string
  architecture: string
  locale: string
  safeStorageAvailable: boolean
}
