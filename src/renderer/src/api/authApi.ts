import { getPreloadApi } from './preloadClient'

export const authApi = {
  getLoginStatus: () => getPreloadApi().auth.getLoginStatus(),
  getCurrentUser: () => getPreloadApi().auth.getCurrentUser(),
  logout: () => getPreloadApi().auth.logout()
}
