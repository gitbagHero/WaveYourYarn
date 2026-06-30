import type { LoginQrResult, LoginStatusResult, QrStatusResult } from '../../types/auth'
import { callNcmApi } from './ncmApi'
import { normalizeNcmUserProfile } from './NCMUserService'

type CookieProvider = () => Promise<string | null>

export class NCMAuthService {
  constructor(private readonly getCookie: CookieProvider = async () => null) {}

  async getQrKey(): Promise<string> {
    const response = await callNcmApi('login_qr_key', { timestamp: Date.now() })
    const data = toRecord(response.body?.data)
    const key = data.unikey

    if (!key) {
      throw new Error('二维码 key 获取失败')
    }

    return String(key)
  }

  async createQrCode(key: string): Promise<LoginQrResult> {
    const response = await callNcmApi('login_qr_create', {
      key,
      qrimg: true,
      platform: 'web',
      timestamp: Date.now()
    })

    const data = toRecord(response.body?.data)

    if (!data?.qrurl && !data?.qrimg) {
      throw new Error('二维码生成失败')
    }

    return {
      key,
      qrUrl: data.qrurl ? String(data.qrurl) : undefined,
      qrImageBase64: data.qrimg ? String(data.qrimg) : undefined
    }
  }

  async checkQrStatus(key: string): Promise<QrStatusResult> {
    const response = await callNcmApi('login_qr_check', { key, timestamp: Date.now() })
    const body = response.body ?? {}
    const code = Number(body.code)
    const cookie = typeof body.cookie === 'string' ? body.cookie : undefined

    return {
      status: mapQrStatus(code),
      code,
      message: normalizeQrMessage(code, body.message ?? body.msg),
      cookie
    }
  }

  async getLoginStatus(): Promise<LoginStatusResult> {
    const cookie = await this.getCookie()

    if (!cookie) {
      return { isLoggedIn: false }
    }

    const response = await callNcmApi('login_status', { cookie })
    const data = toRecord(response.body?.data ?? response.body)
    const profile = normalizeNcmUserProfile(data.profile ?? data.account ?? data)

    return profile
      ? {
          isLoggedIn: true,
          user: {
            id: profile.userId,
            ncmUserId: profile.userId,
            nickname: profile.nickname,
            avatarUrl: profile.avatarUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }
      : { isLoggedIn: false }
  }

  async logout(): Promise<void> {
    const cookie = await this.getCookie()
    await callNcmApi('logout', cookie ? { cookie } : {})
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function mapQrStatus(code: number): QrStatusResult['status'] {
  switch (code) {
    case 800:
      return 'expired'
    case 801:
      return 'waiting'
    case 802:
      return 'scanned'
    case 803:
      return 'authorized'
    default:
      return 'failed'
  }
}

function normalizeQrMessage(code: number, fallback?: unknown): string {
  if (typeof fallback === 'string' && fallback.length > 0) {
    return fallback
  }

  switch (code) {
    case 800:
      return '二维码已过期，请刷新后重新扫码'
    case 801:
      return '等待扫码'
    case 802:
      return '已扫码，请在手机上确认'
    case 803:
      return '登录成功'
    default:
      return '二维码登录状态异常'
  }
}
