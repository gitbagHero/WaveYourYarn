import type { IpcResult } from '../../../main/types/common'
import { getPreloadApi } from './preloadClient'
import type { ExportOptions, ExportRecord, ExportResult } from '../types/export'

export const exportApi = {
  exportLikedSongs: async (options: ExportOptions) =>
    unwrap(await getPreloadApi().export.exportLikedSongs(options)),
  getExportRecords: async () => unwrap(await getPreloadApi().export.getExportRecords()),
  openFile: async (filePath: string) => unwrap(await getPreloadApi().export.openFile(filePath)),
  openFolder: async (filePath: string) => unwrap(await getPreloadApi().export.openFolder(filePath)),
  clearRecords: async () => unwrap(await getPreloadApi().export.clearRecords())
}

function unwrap<T>(result: IpcResult<T>): T {
  if (result.success) {
    return result.data as T
  }

  throw new Error(result.message ?? result.error ?? '导出操作失败')
}

export type { ExportOptions, ExportRecord, ExportResult }
