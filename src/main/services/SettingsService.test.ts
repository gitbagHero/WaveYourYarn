import { afterEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SettingsRepository } from '../db/repositories/SettingsRepository'
import { createTestDatabase } from '../db/testing/createTestDatabase'
import { SettingsService } from './SettingsService'

describe('SettingsService public settings boundary', () => {
  const databases: Database.Database[] = []
  const directories: string[] = []

  afterEach(async () => {
    for (const db of databases.splice(0)) {
      db.close()
    }
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
  })

  it('returns only allowlisted public settings', () => {
    const db = createTestDatabase()
    databases.push(db)
    const repository = new SettingsRepository(db)
    repository.set('default_export_directory', '/exports')
    repository.set('secret:ncm_cookie', 'MUSIC_U=hidden')
    repository.set('liked_songs_last_sync_result', '{"secret":true}')
    const service = new SettingsService(repository)

    expect(service.getAll()).toEqual({
      default_export_directory: '/exports',
      ai_disclosure_confirmation_mode: 'allow_remembered'
    })
    expect(() => service.get('secret:ncm_cookie' as never)).toThrow('不支持的设置项')
  })

  it('validates the public AI disclosure confirmation mode', async () => {
    const db = createTestDatabase()
    databases.push(db)
    const service = new SettingsService(new SettingsRepository(db))

    expect(service.get('ai_disclosure_confirmation_mode')).toBe('allow_remembered')
    await service.set('ai_disclosure_confirmation_mode', 'always')
    expect(service.getAll().ai_disclosure_confirmation_mode).toBe('always')
    await expect(service.set('ai_disclosure_confirmation_mode', 'sometimes')).rejects.toThrow(
      'AI 数据披露确认模式无效'
    )
  })

  it('accepts a writable directory and falls back when the configured path is unavailable', async () => {
    const db = createTestDatabase()
    databases.push(db)
    const repository = new SettingsRepository(db)
    const service = new SettingsService(repository)
    const directory = await mkdtemp(join(tmpdir(), 'waveyouryarn-settings-'))
    directories.push(directory)

    await service.set('default_export_directory', directory)
    expect(service.get('default_export_directory')).toBe(directory)

    repository.set('default_export_directory', join(directory, 'missing'))
    expect(await service.resolveDefaultExportDirectory('/fallback')).toBe('/fallback')
  })
})
