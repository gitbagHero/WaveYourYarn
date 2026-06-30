export type ExportType = 'csv' | 'json' | 'markdown'

export interface ExportRecord {
  id: string
  exportType: ExportType
  filePath: string
  songCount: number
  createdAt: string
}
