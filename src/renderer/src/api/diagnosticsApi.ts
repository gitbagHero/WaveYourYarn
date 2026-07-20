import { getPreloadApi } from './preloadClient'

export const diagnosticsApi = {
  getSummary: () => getPreloadApi().diagnostics.getSummary(),
  export: () => getPreloadApi().diagnostics.export()
}
