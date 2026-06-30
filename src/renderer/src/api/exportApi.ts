import { getPreloadApi } from './preloadClient'

export const exportApi = {
  exportCsv: (options: unknown) => getPreloadApi().export.exportCsv(options),
  exportJson: (options: unknown) => getPreloadApi().export.exportJson(options),
  exportMarkdown: (options: unknown) => getPreloadApi().export.exportMarkdown(options),
  getExportRecords: () => getPreloadApi().export.getExportRecords()
}
