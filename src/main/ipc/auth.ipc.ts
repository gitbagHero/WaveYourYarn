import { ipcMain } from 'electron'
import { notImplemented } from '../utils/errors'

export function registerAuthIpc(): void {
  ipcMain.handle('auth:get-login-status', () => notImplemented())
  ipcMain.handle('auth:get-current-user', () => notImplemented())
  ipcMain.handle('auth:logout', () => notImplemented())
}
