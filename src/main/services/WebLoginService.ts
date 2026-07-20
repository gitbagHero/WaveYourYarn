import { BrowserWindow, session } from 'electron'
import { logger } from '../utils/logger'
import { denyAllSessionPermissions, hardenNcmLoginWindow } from '../security/electronSecurity'

const NCM_LOGIN_PARTITION = 'persist:ncm-login'
const NCM_HOME_URL = 'https://music.163.com'
const COOKIE_POLL_INTERVAL_MS = 2000

export class WebLoginService {
  private loginWindow: BrowserWindow | null = null
  private pollTimer: NodeJS.Timeout | null = null

  async openLoginWindow(): Promise<string> {
    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow.focus()
    }

    const webSession = session.fromPartition(NCM_LOGIN_PARTITION)
    denyAllSessionPermissions(webSession, 'ncm-login')

    if (!this.loginWindow || this.loginWindow.isDestroyed()) {
      this.loginWindow = new BrowserWindow({
        title: '登录网易云音乐 - WaveYourYarn',
        width: 1120,
        height: 760,
        minWidth: 960,
        minHeight: 640,
        webPreferences: {
          session: webSession,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      })

      hardenNcmLoginWindow(this.loginWindow)
      await this.loginWindow.loadURL(NCM_HOME_URL)
      logger.info('已打开网易云网页登录窗口')
    }

    return this.waitForLoginCookie(webSession)
  }

  async clearLoginSession(): Promise<void> {
    this.clearPollTimer()
    const webSession = session.fromPartition(NCM_LOGIN_PARTITION)
    const cookies = await webSession.cookies.get({ url: NCM_HOME_URL })

    await Promise.all(
      cookies.map((cookie) =>
        webSession.cookies.remove(
          `${cookie.secure ? 'https' : 'http'}://${(cookie.domain ?? 'music.163.com').replace(/^\./, '')}`,
          cookie.name
        )
      )
    )
  }

  async getNcmCookies(): Promise<string> {
    const webSession = session.fromPartition(NCM_LOGIN_PARTITION)
    return this.readNcmCookie(webSession)
  }

  private waitForLoginCookie(webSession: Electron.Session): Promise<string> {
    this.clearPollTimer()

    return new Promise((resolve, reject) => {
      let settled = false

      const cleanup = (): void => {
        settled = true
        this.clearPollTimer()
        webSession.cookies.off('changed', handleCookieChanged)
        this.loginWindow?.off('closed', handleWindowClosed)
      }

      const resolveIfLoggedIn = async (): Promise<void> => {
        if (settled) {
          return
        }

        const cookieString = await this.readNcmCookie(webSession, false)

        if (!cookieString.includes('MUSIC_U=')) {
          return
        }

        cleanup()
        logger.info('检测到网易云网页登录 Cookie', {
          hasMusicU: true,
          hasCsrf: cookieString.includes('__csrf='),
          count: cookieString.split(';').filter(Boolean).length
        })
        this.closeLoginWindow()
        resolve(cookieString)
      }

      const handleCookieChanged = (): void => {
        void resolveIfLoggedIn()
      }

      const handleWindowClosed = (): void => {
        if (settled) {
          return
        }

        cleanup()
        this.loginWindow = null
        reject(new Error('网页登录窗口已关闭，登录未完成'))
      }

      webSession.cookies.on('changed', handleCookieChanged)
      this.loginWindow?.on('closed', handleWindowClosed)
      this.pollTimer = setInterval(() => {
        void resolveIfLoggedIn()
      }, COOKIE_POLL_INTERVAL_MS)
      void resolveIfLoggedIn()
    })
  }

  private async readNcmCookie(webSession: Electron.Session, throwIfMissing = true): Promise<string> {
    const cookies = await webSession.cookies.get({ url: NCM_HOME_URL })
    const cookieString = cookies
      .filter((cookie) => {
        const domain = cookie.domain ?? 'music.163.com'
        return domain.includes('music.163.com') || domain.includes('163.com')
      })
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ')

    if (!cookieString && throwIfMissing) {
      throw new Error('未读取到网易云登录 Cookie，请先在网页登录窗口完成登录')
    }

    return cookieString
  }

  private closeLoginWindow(): void {
    this.clearPollTimer()

    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow.close()
    }

    this.loginWindow = null
  }

  private clearPollTimer(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }
}
