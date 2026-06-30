import { getPreloadApi } from './preloadClient'

export const settingsApi = {
  get: (key: string) => getPreloadApi().settings.get(key),
  set: (key: string, value: string) => getPreloadApi().settings.set(key, value),
  getAll: () => getPreloadApi().settings.getAll()
}
