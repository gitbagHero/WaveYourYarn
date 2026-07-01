export type ExportFormat = 'csv' | 'json' | 'markdown'
export type ExportType = ExportFormat
export type ExportScope = 'all' | 'filtered'
export type ExportSortMode = 'likedAtDesc' | 'likedAtAsc' | 'originalOrder'

export interface ExportOptions {
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
}

export interface ExportRecord {
  id: string
  exportType: ExportFormat
  filePath: string
  songCount: number
  createdAt: string
  scope?: ExportScope
  sortMode?: ExportSortMode
}
