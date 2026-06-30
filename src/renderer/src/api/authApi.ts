import { getPreloadApi } from './preloadClient'

export const authApi = {
  startWebLogin: () => getPreloadApi().auth.startWebLogin(),
  completeWebLogin: () => getPreloadApi().auth.completeWebLogin(),
  loginWithCookie: (cookie: string) => getPreloadApi().auth.loginWithCookie(cookie),
  getLoginQr: () => getPreloadApi().auth.getLoginQr(),
  checkQrStatus: (key: string) => getPreloadApi().auth.checkQrStatus(key),
  getLoginStatus: () => getPreloadApi().auth.getLoginStatus(),
  getCurrentUser: () => getPreloadApi().auth.getCurrentUser(),
  logout: () => getPreloadApi().auth.logout()
}
