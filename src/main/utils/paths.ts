import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

export function getAppDataDir(): string {
  return join(app.getPath('userData'), 'WaveYourYarn')
}

export function getDatabasePath(): string {
  return join(getAppDataDir(), 'waveyouryarn.db')
}

export function getLogsDir(): string {
  return join(getAppDataDir(), 'logs')
}

export function getRecoveryDir(): string {
  return join(getAppDataDir(), 'recovery')
}

export function ensureAppDirectories(): void {
  mkdirSync(getAppDataDir(), { recursive: true })
  mkdirSync(getLogsDir(), { recursive: true })
  mkdirSync(getRecoveryDir(), { recursive: true })
}
