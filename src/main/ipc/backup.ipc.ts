import { app, dialog } from 'electron'
import { join } from 'node:path'
import { BackupService, DatabaseSwapRequiresRestartError } from '../services/BackupService'
import type {
  BackupCreateResult,
  BackupRestoreResult,
  BackupRestoreSelection
} from '../types/backup'
import type { IpcResult } from '../types/common'
import { getAppDataDir, getDatabasePath } from '../utils/paths'
import { RestoreSelectionStore } from '../security/RestoreSelectionStore'
import { ipcFailure } from './ipcResult'
import { registerIpcHandler } from './registerIpcHandler'

const restoreSelections = new RestoreSelectionStore()

export function registerBackupIpc(): void {
  const backupService = new BackupService(undefined, {
    databasePath: getDatabasePath(),
    appDataDirectory: getAppDataDir()
  })

  registerIpcHandler('backup:create', async (): Promise<IpcResult<BackupCreateResult | null>> => {
    const result = await dialog.showSaveDialog({
      title: '创建 WaveYourYarn 数据库备份',
      defaultPath: join(app.getPath('downloads'), createDefaultBackupFileName()),
      filters: [{ name: 'WaveYourYarn Backup', extensions: ['wyybackup'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: true, data: null }
    }

    try {
      const data = await backupService.createBackup(
        ensureBackupExtension(result.filePath),
        app.getVersion(),
        `${process.platform}-${process.arch}`
      )
      return { success: true, data }
    } catch (error) {
      return ipcFailure('创建数据库备份失败', error)
    }
  })

  registerIpcHandler(
    'backup:select-for-restore',
    async (): Promise<IpcResult<BackupRestoreSelection | null>> => {
      const result = await dialog.showOpenDialog({
        title: '选择 WaveYourYarn 数据库备份',
        properties: ['openFile'],
        filters: [{ name: 'WaveYourYarn Backup', extensions: ['wyybackup'] }]
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null }
      }

      try {
        const backupPath = result.filePaths[0]
        const preview = await backupService.inspectBackup(backupPath)
        const token = restoreSelections.issue(backupPath)
        return {
          success: true,
          data: { token, preview }
        }
      } catch (error) {
        return ipcFailure('备份文件校验失败', error)
      }
    }
  )

  registerIpcHandler(
    'backup:restore',
    async (_event, token: unknown): Promise<IpcResult<BackupRestoreResult>> => {
      if (typeof token !== 'string' || !token.trim()) {
        return {
          success: false,
          message: '恢复凭证无效，请重新选择备份文件',
          error: 'INVALID_RESTORE_TOKEN'
        }
      }

      const backupPath = restoreSelections.consume(token)

      if (!backupPath) {
        return {
          success: false,
          message: '恢复凭证已失效，请重新选择备份文件',
          error: 'EXPIRED_RESTORE_TOKEN'
        }
      }

      try {
        const data = await backupService.restoreBackup(backupPath)
        scheduleRestart()
        return { success: true, data }
      } catch (error) {
        if (error instanceof DatabaseSwapRequiresRestartError) {
          scheduleRestart()
        }

        return ipcFailure('恢复数据库失败', error)
      }
    }
  )
}

function createDefaultBackupFileName(): string {
  const date = new Date().toISOString().slice(0, 10)
  return `WaveYourYarn-${date}.wyybackup`
}

function ensureBackupExtension(filePath: string): string {
  return filePath.toLowerCase().endsWith('.wyybackup') ? filePath : `${filePath}.wyybackup`
}

function scheduleRestart(): void {
  setTimeout(() => {
    app.relaunch()
    app.exit(0)
  }, 800)
}
