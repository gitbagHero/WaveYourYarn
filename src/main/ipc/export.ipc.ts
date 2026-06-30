import { ipcMain } from 'electron'
import { notImplemented } from '../utils/errors'

export function registerExportIpc(): void {
  ipcMain.handle('export:csv', () => notImplemented())
  ipcMain.handle('export:json', () => notImplemented())
  ipcMain.handle('export:markdown', () => notImplemented())
  ipcMain.handle('export:get-records', () => notImplemented())
}
