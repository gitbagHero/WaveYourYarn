export const BACKUP_FORMAT = 'waveyouryarn-backup'
export const BACKUP_FORMAT_VERSION = 1

export interface BackupDataCounts {
  users: number
  songs: number
  playlists: number
  playlistSongs: number
  exportRecords: number
  publicSettings: number
}

export interface BackupManifest {
  format: typeof BACKUP_FORMAT
  formatVersion: typeof BACKUP_FORMAT_VERSION
  appVersion: string
  schemaVersion: number
  createdAt: string
  sourcePlatform: string
  databaseSizeBytes: number
  databaseSha256: string
  counts: BackupDataCounts
}

export interface BackupPreview extends BackupManifest {
  fileName: string
}

export interface BackupCreateResult {
  fileName: string
  manifest: BackupManifest
}

export interface BackupRestoreSelection {
  token: string
  preview: BackupPreview
}

export interface BackupRestoreResult {
  restoredAt: string
  emergencyBackupFileName: string
  restartRequired: true
}
