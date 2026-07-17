import { safeStorage } from 'electron'
import { SettingsRepository } from '../db/repositories/SettingsRepository'
import { logger } from '../utils/logger'

const SECRET_PREFIX = 'secret:'
const SAFE_STORAGE_PREFIX = 'safe:'
const PLAIN_STORAGE_PREFIX = 'plain:'

export class SecureStorageService {
  constructor(private readonly settingsRepository = new SettingsRepository()) {}

  async setSecret(key: string, value: string): Promise<void> {
    const storageKey = toStorageKey(key)

    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value).toString('base64')
      this.settingsRepository.set(storageKey, `${SAFE_STORAGE_PREFIX}${encrypted}`)
      return
    }

    logger.warn('safeStorage is unavailable; refusing to persist a plaintext secret')
    throw new Error('系统安全存储当前不可用，无法安全保存登录凭证')
  }

  async getSecret(key: string): Promise<string | null> {
    const storageKey = toStorageKey(key)
    const value = this.settingsRepository.get(storageKey)

    if (!value) {
      return null
    }

    if (value.startsWith(SAFE_STORAGE_PREFIX)) {
      const encrypted = Buffer.from(value.slice(SAFE_STORAGE_PREFIX.length), 'base64')
      return safeStorage.decryptString(encrypted)
    }

    if (value.startsWith(PLAIN_STORAGE_PREFIX)) {
      const plaintext = value.slice(PLAIN_STORAGE_PREFIX.length)

      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(plaintext).toString('base64')
        this.settingsRepository.set(storageKey, `${SAFE_STORAGE_PREFIX}${encrypted}`)
        logger.info('历史明文登录凭证已迁移到系统安全存储')
        return plaintext
      }

      this.settingsRepository.remove(storageKey)
      logger.warn('系统安全存储不可用，历史明文登录凭证已移除')
      return null
    }

    return value
  }

  async removeSecret(key: string): Promise<void> {
    this.settingsRepository.remove(toStorageKey(key))
  }
}

function toStorageKey(key: string): string {
  return `${SECRET_PREFIX}${key}`
}
