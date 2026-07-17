import { getPreloadApi } from './preloadClient'
import type { PublicSettingKey } from '../types/settings'

export const settingsApi = {
  get: (key: PublicSettingKey) => getPreloadApi().settings.get(key),
  set: (key: PublicSettingKey, value: string) => getPreloadApi().settings.set(key, value),
  getAll: () => getPreloadApi().settings.getAll(),
  selectExportDirectory: () => getPreloadApi().settings.selectExportDirectory(),
  resetExportDirectory: () => getPreloadApi().settings.resetExportDirectory()
}
