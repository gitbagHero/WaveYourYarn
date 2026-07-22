import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { SettingsRepository } from '../db/repositories/SettingsRepository'
import {
  AI_DISCLOSURE_CONFIRMATION_MODES,
  type AIDisclosureConfirmationMode,
  type PublicSettingKey,
  type PublicSettings
} from '../types/settings'
import { logger } from '../utils/logger'

export const DEFAULT_EXPORT_DIRECTORY_KEY: PublicSettingKey = 'default_export_directory'
export const AI_DISCLOSURE_CONFIRMATION_MODE_KEY: PublicSettingKey =
  'ai_disclosure_confirmation_mode'
export const DEFAULT_AI_DISCLOSURE_CONFIRMATION_MODE: AIDisclosureConfirmationMode =
  'allow_remembered'
const PUBLIC_SETTING_KEYS = new Set<PublicSettingKey>([
  DEFAULT_EXPORT_DIRECTORY_KEY,
  AI_DISCLOSURE_CONFIRMATION_MODE_KEY
])

export class SettingsService {
  constructor(private readonly settingsRepository = new SettingsRepository()) {}

  get(key: PublicSettingKey): string | null {
    assertPublicSettingKey(key)
    const value = this.settingsRepository.get(key)
    if (key === AI_DISCLOSURE_CONFIRMATION_MODE_KEY) {
      return isAIDisclosureConfirmationMode(value) ? value : DEFAULT_AI_DISCLOSURE_CONFIRMATION_MODE
    }
    return value
  }

  async set(key: PublicSettingKey, value: string): Promise<void> {
    assertPublicSettingKey(key)

    if (key === DEFAULT_EXPORT_DIRECTORY_KEY) {
      await assertWritableDirectory(value)
    } else if (!isAIDisclosureConfirmationMode(value)) {
      throw new Error('AI 数据披露确认模式无效')
    }

    this.settingsRepository.set(key, value.trim())
  }

  remove(key: PublicSettingKey): void {
    assertPublicSettingKey(key)
    this.settingsRepository.remove(key)
  }

  getAll(): PublicSettings {
    const defaultExportDirectory = this.settingsRepository.get(DEFAULT_EXPORT_DIRECTORY_KEY)
    const confirmationMode = this.get(
      AI_DISCLOSURE_CONFIRMATION_MODE_KEY
    ) as AIDisclosureConfirmationMode

    return {
      ...(defaultExportDirectory ? { default_export_directory: defaultExportDirectory } : {}),
      ai_disclosure_confirmation_mode: confirmationMode
    }
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

function isAIDisclosureConfirmationMode(value: unknown): value is AIDisclosureConfirmationMode {
  return (
    typeof value === 'string' &&
    AI_DISCLOSURE_CONFIRMATION_MODES.includes(value as AIDisclosureConfirmationMode)
  )
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
