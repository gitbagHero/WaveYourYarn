import { getPreloadApi } from './preloadClient'

export const authApi = {
  openWebLogin: () => getPreloadApi().auth.openWebLogin(),
  startWebLogin: () => getPreloadApi().auth.startWebLogin(),
  completeWebLogin: () => getPreloadApi().auth.completeWebLogin(),
  loginWithCookie: (cookie: string) => getPreloadApi().auth.loginWithCookie(cookie),
  getLoginQr: () => getPreloadApi().auth.getLoginQr(),
  checkQrStatus: (key: string) => getPreloadApi().auth.checkQrStatus(key),
  getLoginStatus: () => getPreloadApi().auth.getLoginStatus(),
  getCurrentUser: () => getPreloadApi().auth.getCurrentUser(),
  logout: () => getPreloadApi().auth.logout(),
  clearWebLoginSession: () => getPreloadApi().auth.clearWebLoginSession()
}
