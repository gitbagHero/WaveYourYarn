import { ipcMain } from 'electron'
import { notImplemented } from '../utils/errors'

export function registerSongsIpc(): void {
  ipcMain.handle('songs:sync-liked-songs', () => notImplemented())
  ipcMain.handle('songs:get-liked-songs', () => notImplemented())
  ipcMain.handle('songs:search-liked-songs', () => notImplemented())
}
