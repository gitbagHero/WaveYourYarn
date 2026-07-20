import { dialog } from 'electron'
import {
  DEFAULT_EXPORT_DIRECTORY_KEY,
  isPublicSettingKey,
  SettingsService
} from '../services/SettingsService'
import type { IpcResult } from '../types/common'
import { toIpcResult } from './ipcResult'
import { registerIpcHandler } from './registerIpcHandler'

export function registerSettingsIpc(): void {
  const settingsService = new SettingsService()

  registerIpcHandler('settings:get', async (_event, key: unknown) => {
    if (!isPublicSettingKey(key)) {
      return invalidSettingKeyResult()
    }

    return toIpcResult(() => settingsService.get(key), '读取设置失败')
  })

  registerIpcHandler('settings:set', async (_event, key: unknown, value: unknown) => {
    if (!isPublicSettingKey(key)) {
      return invalidSettingKeyResult()
    }

    if (typeof value !== 'string') {
      return {
        success: false,
        message: '设置值格式不正确',
        error: 'INVALID_SETTING_VALUE'
      } satisfies IpcResult
    }

    return toIpcResult(() => settingsService.set(key, value), '保存设置失败')
  })

  registerIpcHandler('settings:get-all', async () =>
    toIpcResult(() => settingsService.getAll(), '读取设置失败')
  )

  registerIpcHandler('settings:select-export-directory', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择默认导出目录',
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return {
        success: true,
        data: settingsService.get(DEFAULT_EXPORT_DIRECTORY_KEY)
      } satisfies IpcResult<string | null>
    }

    const directory = result.filePaths[0]
    return toIpcResult(async () => {
      await settingsService.set(DEFAULT_EXPORT_DIRECTORY_KEY, directory)
      return directory
    }, '保存默认导出目录失败')
  })

  registerIpcHandler('settings:reset-export-directory', async () =>
    toIpcResult(() => settingsService.remove(DEFAULT_EXPORT_DIRECTORY_KEY), '恢复默认导出目录失败')
  )
}

function invalidSettingKeyResult(): IpcResult {
  return {
    success: false,
    message: '不支持的设置项',
    error: 'INVALID_SETTING_KEY'
  }
}
