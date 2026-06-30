import { BrowserWindow, session } from 'electron'
import type { LoginStatusResult } from '../types/auth'
import { logger } from '../utils/logger'
import { AuthService } from './AuthService'

const NCM_LOGIN_PARTITION = 'persist:ncm-login'
const NCM_HOME_URL = 'https://music.163.com'

export class WebLoginService {
  private loginWindow: BrowserWindow | null = null

  constructor(private readonly authService: AuthService) {}

  async openLoginWindow(): Promise<void> {
    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow.focus()
      return
    }

    const webSession = session.fromPartition(NCM_LOGIN_PARTITION)
    this.loginWindow = new BrowserWindow({
      title: '网易云网页登录 - WaveYourYarn',
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

    this.loginWindow.on('closed', () => {
      this.loginWindow = null
    })

    await this.loginWindow.loadURL(NCM_HOME_URL)
    logger.info('已打开网易云网页登录窗口')
  }

  async completeLogin(): Promise<LoginStatusResult> {
    const cookie = await this.readNcmCookie()
    const result = await this.authService.loginWithWebCookie(cookie)
    this.closeLoginWindow()
    return result
  }

  async clearLoginSession(): Promise<void> {
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

  private async readNcmCookie(): Promise<string> {
    const webSession = session.fromPartition(NCM_LOGIN_PARTITION)
    const cookies = await webSession.cookies.get({ url: NCM_HOME_URL })
    const cookieString = cookies
      .filter((cookie) => {
        const domain = cookie.domain ?? 'music.163.com'
        return domain.includes('music.163.com') || domain.includes('163.com')
      })
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ')

    if (!cookieString) {
      throw new Error('未读取到网易云登录 Cookie，请先在网页登录窗口完成登录')
    }

    return cookieString
  }

  private closeLoginWindow(): void {
    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow.close()
    }

    this.loginWindow = null
  }
}
