import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { SettingsRepository } from '../db/repositories/SettingsRepository'
import type { PublicSettingKey, PublicSettings } from '../types/settings'
import { logger } from '../utils/logger'

export const DEFAULT_EXPORT_DIRECTORY_KEY: PublicSettingKey = 'default_export_directory'
const PUBLIC_SETTING_KEYS = new Set<PublicSettingKey>([DEFAULT_EXPORT_DIRECTORY_KEY])

export class SettingsService {
  constructor(private readonly settingsRepository = new SettingsRepository()) {}

  get(key: PublicSettingKey): string | null {
    assertPublicSettingKey(key)
    return this.settingsRepository.get(key)
  }

  async set(key: PublicSettingKey, value: string): Promise<void> {
    assertPublicSettingKey(key)

    if (key === DEFAULT_EXPORT_DIRECTORY_KEY) {
      await assertWritableDirectory(value)
    }

    this.settingsRepository.set(key, value.trim())
  }

  remove(key: PublicSettingKey): void {
    assertPublicSettingKey(key)
    this.settingsRepository.remove(key)
  }

  getAll(): PublicSettings {
    const defaultExportDirectory = this.settingsRepository.get(DEFAULT_EXPORT_DIRECTORY_KEY)

    return defaultExportDirectory
      ? { default_export_directory: defaultExportDirectory }
      : {}
  }

  async resolveDefaultExportDirectory(fallbackDirectory: string): Promise<string> {
    const configuredDirectory = this.get(DEFAULT_EXPORT_DIRECTORY_KEY)

    if (!configuredDirectory) {
      return fallbackDirectory
    }

    try {
      await assertWritableDirectory(configuredDirectory)
      return configuredDirectory
    } catch (error) {
      logger.warn('默认导出目录不可用，将回退到系统 Downloads', error)
      return fallbackDirectory
    }
  }
}

export function isPublicSettingKey(value: unknown): value is PublicSettingKey {
  return typeof value === 'string' && PUBLIC_SETTING_KEYS.has(value as PublicSettingKey)
}

function assertPublicSettingKey(value: unknown): asserts value is PublicSettingKey {
  if (!isPublicSettingKey(value)) {
    throw new Error('不支持的设置项')
  }
}

async function assertWritableDirectory(value: string): Promise<void> {
  const directory = value.trim()

  if (!directory || !isAbsolute(directory)) {
    throw new Error('导出目录必须是有效的绝对路径')
  }

  const info = await stat(directory)

  if (!info.isDirectory()) {
    throw new Error('选择的导出路径不是目录')
  }

  await access(directory, constants.W_OK)
}
