import { registerAppIpc } from './app.ipc'
import { registerAuthIpc } from './auth.ipc'
import { registerSongsIpc } from './songs.ipc'
import { registerExportIpc } from './export.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerPlaylistsIpc } from './playlists.ipc'

export function registerIpcHandlers(): void {
  registerAppIpc()
  registerAuthIpc()
  registerSongsIpc()
  registerPlaylistsIpc()
  registerExportIpc()
  registerSettingsIpc()
}
