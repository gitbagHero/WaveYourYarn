import { afterEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDatabase } from '../db/testing/createTestDatabase'
import { LLMProfileRepository } from '../db/repositories/LLMProfileRepository'
import type { SecretStorage } from './LLMProfileService'
import { LLMProfileService } from './LLMProfileService'

describe('LLMProfileService', () => {
  const databases: Database.Database[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('stores API keys separately and returns renderer-safe profiles', async () => {
    const { service, secrets } = createService(databases)
    const profile = await service.create({
      name: ' Primary ',
      baseUrl: 'https://llm.example.test/v1',
      modelId: ' model-a ',
      apiKey: ' top-secret '
    })

    expect(profile).toMatchObject({
      id: 'profile-1',
      name: 'Primary',
      baseUrl: 'https://llm.example.test/v1/',
      modelId: 'model-a',
      timeoutMs: 180_000,
      maxInputSongs: 100,
      isActive: true,
      hasApiKey: true
    })
    expect(JSON.stringify(profile)).not.toMatch(/top-secret|secretRef|apiKey/)
    expect(secrets.get('llm-profile:profile-1:api-key')).toBe('top-secret')
    expect(await service.getRuntimeProfile(profile.id)).toMatchObject({ apiKey: 'top-secret' })
  })

  it('validates unsafe endpoints and the bounded song count', async () => {
    const { service } = createService(databases)

    await expect(
      service.create({ name: 'Unsafe', baseUrl: 'http://example.test/v1', modelId: 'model-a' })
    ).rejects.toMatchObject({ code: 'HTTPS_REQUIRED' })
    await expect(
      service.create({
        name: 'Too many songs',
        baseUrl: 'https://example.test/v1',
        modelId: 'model-a',
        maxInputSongs: 101
      })
    ).rejects.toMatchObject({ code: 'INVALID_PROFILE' })
    await expect(
      service.create({
        name: 'Unsupported mode',
        baseUrl: 'https://example.test/v1',
        modelId: 'model-a',
        outputMode: 'json_schema'
      })
    ).rejects.toMatchObject({ code: 'INVALID_PROFILE' })
  })

  it('rotates credentials and promotes a remaining profile after deletion', async () => {
    const { service, secrets } = createService(databases)
    const primary = await service.create({
      name: 'Primary',
      baseUrl: 'https://one.example.test/v1',
      modelId: 'model-a',
      apiKey: 'key-a'
    })
    const secondary = await service.create({
      name: 'Secondary',
      baseUrl: 'https://two.example.test/v1',
      modelId: 'model-b'
    })

    await service.setApiKey(secondary.id, 'key-b')
    expect((await service.get(secondary.id)).hasApiKey).toBe(true)
    await service.setActive(secondary.id)
    expect((await service.getActive())?.id).toBe(secondary.id)

    expect(await service.delete(secondary.id)).toBe(true)
    expect(secrets.has('llm-profile:profile-2:api-key')).toBe(false)
    expect((await service.getActive())?.id).toBe(primary.id)

    await service.deleteApiKey(primary.id)
    await expect(service.getRuntimeProfile(primary.id)).rejects.toMatchObject({
      code: 'API_KEY_MISSING'
    })
  })
})

function createService(databases: Database.Database[]): {
  service: LLMProfileService
  secrets: Map<string, string>
} {
  const db = createTestDatabase()
  databases.push(db)
  const secrets = new Map<string, string>()
  const storage: SecretStorage = {
    async setSecret(key, value) {
      secrets.set(key, value)
    },
    async getSecret(key) {
      return secrets.get(key) ?? null
    },
    async removeSecret(key) {
      secrets.delete(key)
    }
  }
  let id = 0
  let tick = 0
  return {
    service: new LLMProfileService(
      new LLMProfileRepository(db),
      storage,
      () => `profile-${++id}`,
      () => `2026-01-01T00:00:0${tick++}.000Z`
    ),
    secrets
  }
}
