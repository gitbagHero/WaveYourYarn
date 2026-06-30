import { getPreloadApi } from './preloadClient'

export const appApi = {
  getVersion: () => getPreloadApi().app.getVersion(),
  ping: () => getPreloadApi().app.ping()
}
