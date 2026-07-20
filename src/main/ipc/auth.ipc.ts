import { AuthService } from '../services/AuthService'
import type { IpcResult } from '../types/common'
import { toIpcResult } from './ipcResult'
import { registerIpcHandler } from './registerIpcHandler'

export function registerAuthIpc(): void {
  const authService = new AuthService()

  registerIpcHandler('auth:open-web-login', async () =>
    toIpcResult(() => authService.openWebLogin(), '网页登录失败，请重试')
  )

  registerIpcHandler('auth:start-web-login', async () =>
    toIpcResult(() => authService.openWebLogin(), '网页登录失败，请重试')
  )

  // Deprecated: retained as a compatibility alias for older renderer builds.
  registerIpcHandler('auth:complete-web-login', async () =>
    toIpcResult(() => authService.getLoginStatus(), '网页登录验证失败')
  )

  registerIpcHandler('auth:login-with-cookie', async (_event, cookie: unknown) => {
    if (typeof cookie !== 'string' || cookie.trim().length === 0) {
      return {
        success: false,
        message: 'Cookie 不能为空',
        error: 'INVALID_COOKIE'
      } satisfies IpcResult
    }

    return toIpcResult(() => authService.loginWithCookie(cookie), 'Cookie 无效或已过期，请重新获取')
  })

  // Deprecated: QR login is unstable due to NetEase risk control.
  registerIpcHandler('auth:get-login-qr', async () =>
    toIpcResult(() => authService.getLoginQr(), '二维码生成失败')
  )

  // Deprecated: QR login is unstable due to NetEase risk control.
  registerIpcHandler('auth:check-qr-status', async (_event, key: unknown) => {
    if (typeof key !== 'string' || key.trim().length === 0) {
      return {
        success: false,
        message: '二维码 key 不能为空',
        error: 'INVALID_QR_KEY'
      } satisfies IpcResult
    }

    return toIpcResult(() => authService.checkQrStatus(key), '二维码状态检查失败')
  })

  registerIpcHandler('auth:get-login-status', async () =>
    toIpcResult(() => authService.getLoginStatus(), '登录状态检查失败')
  )

  registerIpcHandler('auth:get-current-user', async () =>
    toIpcResult(() => authService.getCurrentUser(), '当前用户信息获取失败')
  )

  registerIpcHandler('auth:logout', async () =>
    toIpcResult(async () => {
      await authService.logout()
      await authService.clearWebLoginSession()
    }, '退出登录失败')
  )

  registerIpcHandler('auth:clear-web-login-session', async () =>
    toIpcResult(() => authService.clearWebLoginSession(), '清理网页登录 Session 失败')
  )
}
