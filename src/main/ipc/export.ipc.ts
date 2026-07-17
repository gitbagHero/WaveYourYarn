import { ipcMain } from 'electron'
import { EXPORT_CANCELLED_CODE, ExportService } from '../services/ExportService'
import type { ExportFormat, ExportOptions, ExportSource } from '../types/export'
import type { IpcResult } from '../types/common'
import { toErrorMessage } from '../utils/errors'

const exportService = new ExportService()

export function registerExportIpc(): void {
  ipcMain.handle('export:songs', async (_event, options: unknown) => {
    const normalizedOptions = parseExportOptions(options)

    if (!normalizedOptions) {
      return {
        success: false,
        message: '导出参数格式不正确',
        error: 'INVALID_EXPORT_OPTIONS'
      } satisfies IpcResult
    }

    return toIpcResult(() => exportService.exportSongs(normalizedOptions), '导出失败')
  })

  ipcMain.handle('export:liked-songs', async (_event, options: unknown) => {
    const normalizedOptions = parseExportOptions({
      ...(options && typeof options === 'object' ? options : {}),
      source: { type: 'liked' }
    })

    if (!normalizedOptions) {
      return {
        success: false,
        message: '导出参数格式不正确',
        error: 'INVALID_EXPORT_OPTIONS'
      } satisfies IpcResult
    }

    return toIpcResult(() => exportService.exportLikedSongs(normalizedOptions), '导出失败')
  })

  ipcMain.handle('export:playlist-songs', async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return {
        success: false,
        message: '导出参数格式不正确',
        error: 'INVALID_EXPORT_OPTIONS'
      } satisfies IpcResult
    }

    const record = payload as Record<string, unknown>
    const playlistId = typeof record.playlistId === 'string' ? record.playlistId.trim() : ''
    const normalizedOptions = parseExportOptions({
      ...record,
      source: { type: 'playlist', playlistId }
    })

    if (!playlistId || !normalizedOptions) {
      return {
        success: false,
        message: '导出参数格式不正确',
        error: 'INVALID_EXPORT_OPTIONS'
      } satisfies IpcResult
    }

    return toIpcResult(
      () => exportService.exportPlaylistSongs(playlistId, normalizedOptions),
      '导出失败'
    )
  })

  ipcMain.handle('export:csv', async (_event, options: unknown) =>
    exportWithFormat('csv', options)
  )
  ipcMain.handle('export:json', async (_event, options: unknown) =>
    exportWithFormat('json', options)
  )
  ipcMain.handle('export:markdown', async (_event, options: unknown) =>
    exportWithFormat('markdown', options)
  )

  ipcMain.handle('export:get-records', async () =>
    toIpcResult(() => exportService.getExportRecords(), '读取导出历史失败')
  )

  ipcMain.handle('export:open-file', async (_event, recordId: unknown) => {
    if (typeof recordId !== 'string' || recordId.trim().length === 0) {
      return {
        success: false,
        message: '导出记录 ID 不能为空',
        error: 'INVALID_EXPORT_RECORD_ID'
      } satisfies IpcResult
    }

    return toIpcResult(() => exportService.openExportFile(recordId), '打开文件失败')
  })

  ipcMain.handle('export:open-folder', async (_event, recordId: unknown) => {
    if (typeof recordId !== 'string' || recordId.trim().length === 0) {
      return {
        success: false,
        message: '导出记录 ID 不能为空',
        error: 'INVALID_EXPORT_RECORD_ID'
      } satisfies IpcResult
    }

    return toIpcResult(() => exportService.openExportFolder(recordId), '打开所在目录失败')
  })

  ipcMain.handle('export:clear-records', async () =>
    toIpcResult(() => exportService.clearExportRecords(), '清空导出历史失败')
  )
}

async function exportWithFormat(format: ExportFormat, options: unknown): Promise<IpcResult> {
  const normalizedOptions = parseExportOptions({
    ...(options && typeof options === 'object' ? options : {}),
    format
  })

  if (!normalizedOptions) {
    return {
      success: false,
      message: '导出参数格式不正确',
      error: 'INVALID_EXPORT_OPTIONS'
    }
  }

  return toIpcResult(() => exportService.exportSongs(normalizedOptions), '导出失败')
}

function parseExportOptions(options: unknown): ExportOptions | null {
  if (!options || typeof options !== 'object') {
    return null
  }

  const record = options as Record<string, unknown>

  if (
    !['csv', 'json', 'markdown'].includes(String(record.format)) ||
    !['all', 'filtered'].includes(String(record.scope)) ||
    ![
      'timeDesc',
      'timeAsc',
      'originalOrder',
      'likedAtDesc',
      'likedAtAsc',
      'addedAtDesc',
      'addedAtAsc'
    ].includes(String(record.sortMode))
  ) {
    return null
  }

  const source = parseExportSource(record.source)

  if (!source) {
    return null
  }

  return {
    source,
    format: record.format as ExportOptions['format'],
    scope: record.scope as ExportOptions['scope'],
    keyword: typeof record.keyword === 'string' ? record.keyword : undefined,
    sortMode: record.sortMode as ExportOptions['sortMode']
  }
}

function parseExportSource(source: unknown): ExportSource | null {
  if (source === undefined) {
    return { type: 'liked' }
  }

  if (!source || typeof source !== 'object') {
    return null
  }

  const record = source as Record<string, unknown>

  if (record.type === 'liked') {
    return { type: 'liked' }
  }

  if (record.type === 'playlist' && typeof record.playlistId === 'string' && record.playlistId.trim()) {
    return {
      type: 'playlist',
      playlistId: record.playlistId.trim()
    }
  }

  return null
}

async function toIpcResult<T>(operation: () => Promise<T>, fallbackMessage: string): Promise<IpcResult<T>> {
  try {
    return {
      success: true,
      data: await operation()
    }
  } catch (error) {
    if (error instanceof Error && error.name === EXPORT_CANCELLED_CODE) {
      return {
        success: false,
        message: '已取消导出',
        error: EXPORT_CANCELLED_CODE
      }
    }

    return {
      success: false,
      message: fallbackMessage,
      error: toErrorMessage(error)
    }
  }
}
