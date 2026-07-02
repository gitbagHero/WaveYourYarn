export type ExportFormat = 'csv' | 'json' | 'markdown'
export type ExportType = ExportFormat
export type ExportScope = 'all' | 'filtered'
export type ExportSourceType = 'liked' | 'playlist'
export type ExportSource = { type: 'liked' } | { type: 'playlist'; playlistId: string }
export type ExportSortMode =
  | 'timeDesc'
  | 'timeAsc'
  | 'originalOrder'
  | 'likedAtDesc'
  | 'likedAtAsc'
  | 'addedAtDesc'
  | 'addedAtAsc'

export interface ExportOptions {
  source?: ExportSource
  format: ExportFormat
  scope: ExportScope
  keyword?: string
  sortMode: ExportSortMode
  filePath?: string
}

export interface ExportResult {
  id: string
  format: ExportFormat
  filePath: string
  songCount: number
  exportedAt: string
  sourceType: ExportSourceType
  sourceId?: string
  sourceName: string
}

export interface ExportRecord {
  id: string
  exportType: ExportFormat
  filePath: string
  songCount: number
  sourceType?: ExportSourceType
  sourceId?: string
  sourceName?: string
  createdAt: string
  scope?: ExportScope
  sortMode?: ExportSortMode
}
