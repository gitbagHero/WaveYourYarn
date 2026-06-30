import { app, ipcMain } from 'electron'
import type { IpcResult } from '../types/common'

export function registerAppIpc(): void {
  ipcMain.handle('app:get-version', (): IpcResult<string> => ({
    success: true,
    data: app.getVersion()
  }))

  ipcMain.handle('app:ping', (): IpcResult<string> => ({
    success: true,
    data: 'pong'
  }))
}
