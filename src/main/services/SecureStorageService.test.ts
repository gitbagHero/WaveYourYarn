import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'

const safeStorageState = vi.hoisted(() => ({
  available: true
}))

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => safeStorageState.available,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`, 'utf8'),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^encrypted:/, '')
  }
}))

import { SettingsRepository } from '../db/repositories/SettingsRepository'
import { createTestDatabase } from '../db/testing/createTestDatabase'
import { SecureStorageService } from './SecureStorageService'

describe('SecureStorageService', () => {
  const databases: Database.Database[] = []

  beforeEach(() => {
    safeStorageState.available = true
  })

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('encrypts new secrets and migrates legacy plaintext values', async () => {
    const db = createTestDatabase()
    databases.push(db)
    const repository = new SettingsRepository(db)
    const service = new SecureStorageService(repository)

    await service.setSecret('new-secret', 'sensitive')
    expect(repository.get('secret:new-secret')).toMatch(/^safe:/)
    expect(repository.get('secret:new-secret')).not.toContain('sensitive')
    expect(await service.getSecret('new-secret')).toBe('sensitive')

    repository.set('secret:legacy-secret', 'plain:legacy-value')
    expect(await service.getSecret('legacy-secret')).toBe('legacy-value')
    expect(repository.get('secret:legacy-secret')).toMatch(/^safe:/)
  })

  it('refuses plaintext persistence and removes legacy plaintext when encryption is unavailable', async () => {
    const db = createTestDatabase()
    databases.push(db)
    const repository = new SettingsRepository(db)
    const service = new SecureStorageService(repository)
    safeStorageState.available = false

    await expect(service.setSecret('new-secret', 'sensitive')).rejects.toThrow('系统安全存储')
    expect(repository.get('secret:new-secret')).toBeNull()

    repository.set('secret:legacy-secret', 'plain:legacy-value')
    expect(await service.getSecret('legacy-secret')).toBeNull()
    expect(repository.get('secret:legacy-secret')).toBeNull()
  })
})
