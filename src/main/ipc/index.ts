import { registerAppIpc } from './app.ipc'
import { registerAuthIpc } from './auth.ipc'
import { registerSongsIpc } from './songs.ipc'
import { registerExportIpc } from './export.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerPlaylistsIpc } from './playlists.ipc'
import { registerStatisticsIpc } from './statistics.ipc'
import { registerBackupIpc } from './backup.ipc'
import { registerDiagnosticsIpc } from './diagnostics.ipc'
import { registerLLMProfilesIpc } from './llmProfiles.ipc'
import { createLLMIpcServices, registerLLMJobsIpc } from './llmJobs.ipc'
import { registerAIDisclosureIpc } from './aiDisclosure.ipc'
import { registerAIReportsIpc } from './aiReports.ipc'

export function registerIpcHandlers(): void {
  registerAppIpc()
  registerAuthIpc()
  registerSongsIpc()
  registerPlaylistsIpc()
  registerExportIpc()
  registerStatisticsIpc()
  registerSettingsIpc()
  registerBackupIpc()
  registerDiagnosticsIpc()
  const llmServices = createLLMIpcServices()
  registerLLMProfilesIpc(llmServices.profileService)
  registerLLMJobsIpc(llmServices)
  registerAIDisclosureIpc(llmServices.disclosureService)
  registerAIReportsIpc(llmServices.reportService, llmServices.reportGenerationService)
}
