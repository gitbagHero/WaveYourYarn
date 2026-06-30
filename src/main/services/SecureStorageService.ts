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

    logger.warn('safeStorage is unavailable; storing secret with local fallback')
    this.settingsRepository.set(storageKey, `${PLAIN_STORAGE_PREFIX}${value}`)
  }

  async getSecret(key: string): Promise<string | null> {
    const value = this.settingsRepository.get(toStorageKey(key))

    if (!value) {
      return null
    }

    if (value.startsWith(SAFE_STORAGE_PREFIX)) {
      const encrypted = Buffer.from(value.slice(SAFE_STORAGE_PREFIX.length), 'base64')
      return safeStorage.decryptString(encrypted)
    }

    if (value.startsWith(PLAIN_STORAGE_PREFIX)) {
      // TODO: Replace fallback plaintext storage once safeStorage is available in all target environments.
      return value.slice(PLAIN_STORAGE_PREFIX.length)
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
