import { NCMAdapter } from '../adapters/ncm/NCMAdapter'
import { NCMUserService } from '../adapters/ncm/NCMUserService'
import { UserRepository } from '../db/repositories/UserRepository'
import type { LoginMethod, LoginQrResult, LoginStatusResult, QrStatusResult } from '../types/auth'
import type { UserProfile } from '../types/user'
import { logger } from '../utils/logger'
import { SecureStorageService } from './SecureStorageService'
import { WebLoginService } from './WebLoginService'
import { CacheOwnershipService } from './CacheOwnershipService'

const NCM_COOKIE_KEY = 'ncm_cookie'
const NCM_USER_ID_KEY = 'ncm_user_id'
const NCM_NICKNAME_KEY = 'ncm_nickname'
const NCM_AVATAR_URL_KEY = 'ncm_avatar_url'

interface AuthenticatedUserResult {
  user: UserProfile
  cacheReset: boolean
}

export class AuthService {
  private readonly secureStorageService: SecureStorageService
  private readonly userRepository: UserRepository
  private readonly ncmAdapter: NCMAdapter
  private readonly webLoginService: WebLoginService

  constructor(
    secureStorageService = new SecureStorageService(),
    userRepository = new UserRepository(),
    private readonly cacheOwnershipService = new CacheOwnershipService()
  ) {
    this.secureStorageService = secureStorageService
    this.userRepository = userRepository
    this.ncmAdapter = new NCMAdapter(() => this.secureStorageService.getSecret(NCM_COOKIE_KEY))
    this.webLoginService = new WebLoginService()
  }

  async getLoginQr(): Promise<LoginQrResult> {
    logger.info('开始生成登录二维码')
    const key = await this.ncmAdapter.auth.getQrKey()
    const qrCode = await this.ncmAdapter.auth.createQrCode(key)
    logger.info('二维码生成成功')
    return qrCode
  }

  async checkQrStatus(key: string): Promise<QrStatusResult> {
    const result = await this.ncmAdapter.auth.checkQrStatus(key)
    logger.info('二维码状态变化', { status: result.status, code: result.code })

    if (result.status !== 'authorized') {
      return {
        status: result.status,
        message: result.message
      }
    }

    if (!result.cookie) {
      return {
        status: 'failed',
        message: '登录成功但未获取到登录凭证'
      }
    }

    const authenticated = await this.saveAuthenticatedCookie(result.cookie, 'qr')

    return {
      status: 'authorized',
      message: '登录成功',
      user: authenticated.user,
      cacheReset: authenticated.cacheReset
    }
  }

  async getLoginStatus(): Promise<LoginStatusResult> {
    const cookie = await this.secureStorageService.getSecret(NCM_COOKIE_KEY)

    if (!cookie) {
      logger.info('登录态检查结果', { isLoggedIn: false })
      return { isLoggedIn: false }
    }

    const remoteUser = await this.getCurrentUserFromRemote()

    if (remoteUser) {
      await this.persistUserSecrets(remoteUser)
      const ownership = this.cacheOwnershipService.ensureOwner(remoteUser.ncmUserId)
      logger.info('登录态检查结果', {
        isLoggedIn: true,
        ncmUserId: remoteUser.ncmUserId
      })
      return {
        isLoggedIn: true,
        user: remoteUser,
        cacheReset: ownership.cacheReset
      }
    }

    logger.info('登录态检查结果', { isLoggedIn: false, reason: 'remote_user_unavailable' })
    return { isLoggedIn: false }
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    return (await this.getLoginStatus()).user ?? null
  }

  async loginWithCookie(cookie: string): Promise<LoginStatusResult> {
    const authenticated = await this.saveAuthenticatedCookie(cookie, 'manual_cookie')
    return {
      isLoggedIn: true,
      user: authenticated.user,
      cacheReset: authenticated.cacheReset
    }
  }

  async openWebLogin(): Promise<LoginStatusResult> {
    const cookie = await this.webLoginService.openLoginWindow()
    return this.loginWithWebCookie(cookie)
  }

  async loginWithWebCookie(cookie: string): Promise<LoginStatusResult> {
    const authenticated = await this.saveAuthenticatedCookie(cookie, 'web')
    return {
      isLoggedIn: true,
      user: authenticated.user,
      cacheReset: authenticated.cacheReset
    }
  }

  async verifyCookieAndGetUser(cookie: string): Promise<UserProfile> {
    const normalizedCookie = normalizeCookie(cookie)

    if (!normalizedCookie) {
      throw new Error('Cookie 格式不正确，请重新粘贴完整 Cookie')
    }

    const user = await this.getCurrentUserWithCookie(normalizedCookie)

    if (!user) {
      throw new Error('Cookie 无效或已过期，请重新获取')
    }

    return user
  }

  async verifyCookieLogin(cookie: string): Promise<UserProfile> {
    return this.verifyCookieAndGetUser(cookie)
  }

  async clearWebLoginSession(): Promise<void> {
    await this.webLoginService.clearLoginSession()
  }

  async logout(): Promise<void> {
    try {
      await this.ncmAdapter.auth.logout()
    } catch (error) {
      logger.warn('网易云退出登录请求失败，将继续清理本地登录态', error)
    }

    await this.secureStorageService.removeSecret(NCM_COOKIE_KEY)
    await this.secureStorageService.removeSecret(NCM_USER_ID_KEY)
    await this.secureStorageService.removeSecret(NCM_NICKNAME_KEY)
    await this.secureStorageService.removeSecret(NCM_AVATAR_URL_KEY)
    logger.info('用户退出登录')
  }

  private async getCurrentUserFromRemote(): Promise<UserProfile | null> {
    const ncmUser = await this.ncmAdapter.user.getCurrentUser()

    if (!ncmUser) {
      return null
    }

    const user = this.userRepository.upsertUser({
      ncmUserId: ncmUser.userId,
      nickname: ncmUser.nickname,
      avatarUrl: ncmUser.avatarUrl
    })

    logger.info('用户信息获取成功', { ncmUserId: user.ncmUserId, nickname: user.nickname })
    return user
  }

  private async getCurrentUserWithCookie(cookie: string): Promise<UserProfile | null> {
    const userService = new NCMUserService(async () => cookie)
    const ncmUser = await userService.getCurrentUser()

    if (!ncmUser) {
      return null
    }

    const user = this.userRepository.upsertUser({
      ncmUserId: ncmUser.userId,
      nickname: ncmUser.nickname,
      avatarUrl: ncmUser.avatarUrl
    })

    logger.info('用户信息获取成功', { ncmUserId: user.ncmUserId, nickname: user.nickname })
    return user
  }

  private async saveAuthenticatedCookie(
    cookie: string,
    method: LoginMethod
  ): Promise<AuthenticatedUserResult> {
    const normalizedCookie = normalizeCookie(cookie)

    if (!normalizedCookie) {
      throw new Error('Cookie 格式不正确，请重新获取')
    }

    const user = await this.verifyCookieLogin(normalizedCookie)
    await this.secureStorageService.setSecret(NCM_COOKIE_KEY, normalizedCookie)
    await this.persistUserSecrets(user)
    const ownership = this.cacheOwnershipService.ensureOwner(user.ncmUserId)
    logger.info('登录成功', { method, ncmUserId: user.ncmUserId, nickname: user.nickname })
    return {
      user,
      cacheReset: ownership.cacheReset
    }
  }

  private async persistUserSecrets(user: UserProfile): Promise<void> {
    await this.secureStorageService.setSecret(NCM_USER_ID_KEY, user.ncmUserId)
    await this.secureStorageService.setSecret(NCM_NICKNAME_KEY, user.nickname)

    if (user.avatarUrl) {
      await this.secureStorageService.setSecret(NCM_AVATAR_URL_KEY, user.avatarUrl)
    } else {
      await this.secureStorageService.removeSecret(NCM_AVATAR_URL_KEY)
    }
  }
}

function normalizeCookie(cookie: string): string {
  const trimmed = cookie.trim()

  if (!trimmed || !trimmed.includes('=')) {
    return ''
  }

  return trimmed
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('; ')
}
