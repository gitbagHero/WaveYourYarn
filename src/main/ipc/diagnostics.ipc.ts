import { app, dialog, safeStorage } from 'electron'
import { join } from 'node:path'
import { DiagnosticService } from '../services/DiagnosticService'
import type {
  DiagnosticExportResult,
  DiagnosticRuntimeInfo,
  DiagnosticSummary
} from '../types/diagnostics'
import type { IpcResult } from '../types/common'
import { getAppDataDir, getDatabasePath } from '../utils/paths'
import { ipcFailure } from './ipcResult'
import { registerIpcHandler } from './registerIpcHandler'

export function registerDiagnosticsIpc(): void {
  const diagnosticService = new DiagnosticService(undefined, {
    appDataDirectory: getAppDataDir(),
    databasePath: getDatabasePath()
  })

  registerIpcHandler('diagnostics:get-summary', async (): Promise<IpcResult<DiagnosticSummary>> => {
    try {
      return {
        success: true,
        data: await diagnosticService.getSummary(getRuntimeInfo())
      }
    } catch (error) {
      return ipcFailure('读取诊断信息失败', error)
    }
  })

  registerIpcHandler(
    'diagnostics:export',
    async (): Promise<IpcResult<DiagnosticExportResult | null>> => {
      const result = await dialog.showSaveDialog({
        title: '导出 WaveYourYarn 脱敏诊断包',
        defaultPath: join(app.getPath('downloads'), createDefaultDiagnosticFileName()),
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })

      if (result.canceled || !result.filePath) {
        return { success: true, data: null }
      }

      try {
        return {
          success: true,
          data: await diagnosticService.exportDiagnostics(
            ensureJsonExtension(result.filePath),
            getRuntimeInfo()
          )
        }
      } catch (error) {
        return ipcFailure('导出诊断包失败', error)
      }
    }
  )
}

function getRuntimeInfo(): DiagnosticRuntimeInfo {
  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron ?? 'unknown',
    chromiumVersion: process.versions.chrome ?? 'unknown',
    nodeVersion: process.versions.node,
    platform: process.platform,
    architecture: process.arch,
    locale: app.getLocale(),
    safeStorageAvailable: safeStorage.isEncryptionAvailable()
  }
}

function createDefaultDiagnosticFileName(): string {
  const date = new Date().toISOString().slice(0, 10)
  return `WaveYourYarn-diagnostics-${date}.json`
}

function ensureJsonExtension(filePath: string): string {
  return filePath.toLowerCase().endsWith('.json') ? filePath : `${filePath}.json`
}
