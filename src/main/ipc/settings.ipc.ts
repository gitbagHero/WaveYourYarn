import { ipcMain } from 'electron'
import { notImplemented } from '../utils/errors'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => notImplemented())
  ipcMain.handle('settings:set', () => notImplemented())
  ipcMain.handle('settings:get-all', () => notImplemented())
}
