import type { NCMUserProfile } from '../../types/user'
import { callNcmApi } from './ncmApi'

type CookieProvider = () => Promise<string | null>

export class NCMUserService {
  constructor(private readonly getCookie: CookieProvider = async () => null) {}

  async getCurrentUser(): Promise<NCMUserProfile | null> {
    const cookie = await this.getCookie()

    if (!cookie) {
      return null
    }

    const response = await callNcmApi('user_account', { cookie })
    return normalizeNcmUserProfile(response.body?.profile ?? response.body?.account ?? response.body)
  }

  async getUserProfile(userId: string): Promise<NCMUserProfile> {
    const cookie = await this.getCookie()
    const response = await callNcmApi('user_detail', {
      uid: userId,
      ...(cookie ? { cookie } : {})
    })
    const profile = normalizeNcmUserProfile(response.body?.profile ?? response.body)

    if (!profile) {
      throw new Error('当前用户信息获取失败')
    }

    return profile
  }
}

export function normalizeNcmUserProfile(raw: unknown): NCMUserProfile | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const record = raw as Record<string, unknown>
  const userId = record.userId ?? record.id ?? record.accountId
  const nickname = record.nickname ?? record.userName ?? record.name

  if (!userId || !nickname) {
    return null
  }

  return {
    userId: String(userId),
    nickname: String(nickname),
    avatarUrl: typeof record.avatarUrl === 'string' ? record.avatarUrl : undefined,
    signature: typeof record.signature === 'string' ? record.signature : undefined,
    rawData: raw
  }
}
