import { getPreloadApi } from './preloadClient'

export const backupApi = {
  create: () => getPreloadApi().backup.create(),
  selectForRestore: () => getPreloadApi().backup.selectForRestore(),
  restore: (token: string) => getPreloadApi().backup.restore(token)
}
