import type { BrowserWindow, Session } from 'electron'
import { shell } from 'electron'
import { logger } from '../utils/logger'
import {
  isAllowedExternalUrl,
  isAllowedNcmNavigation,
  isTrustedRendererUrl,
  sanitizeUrlForLog,
  type RendererLocationPolicy
} from './urlPolicy'

export function denyAllSessionPermissions(targetSession: Session, label: string): void {
  targetSession.setPermissionCheckHandler(() => false)
  targetSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    logger.warn('已拒绝 Electron 权限请求', { session: label, permission })
    callback(false)
  })
}

export function hardenMainWindow(window: BrowserWindow, policy: RendererLocationPolicy): void {
  window.webContents.on('will-navigate', (event, navigationUrl) => {
    if (isTrustedRendererUrl(navigationUrl, policy)) {
      return
    }

    event.preventDefault()
    logger.warn('已阻止主窗口导航', { url: sanitizeUrlForLog(navigationUrl) })

    if (isAllowedExternalUrl(navigationUrl)) {
      void openExternalSafely(navigationUrl)
    }
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void openExternalSafely(url)
    } else {
      logger.warn('已阻止主窗口打开外部地址', { url: sanitizeUrlForLog(url) })
    }

    return { action: 'deny' }
  })
}

export function hardenNcmLoginWindow(window: BrowserWindow): void {
  window.webContents.on('will-navigate', (event, navigationUrl) => {
    if (isAllowedNcmNavigation(navigationUrl)) {
      return
    }

    event.preventDefault()
    logger.warn('已阻止网易云登录窗口导航', { url: sanitizeUrlForLog(navigationUrl) })
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNcmNavigation(url)) {
      setImmediate(() => {
        void window.loadURL(url).catch((error) => {
          logger.warn('网易云登录窗口跳转失败', error)
        })
      })
    } else {
      logger.warn('已阻止网易云登录窗口弹窗', { url: sanitizeUrlForLog(url) })
    }

    return { action: 'deny' }
  })
}

async function openExternalSafely(url: string): Promise<void> {
  try {
    await shell.openExternal(url)
  } catch (error) {
    logger.warn('打开受信外部地址失败', error)
  }
}
