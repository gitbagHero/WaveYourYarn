import { afterEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { LLMProfileRepository } from '../db/repositories/LLMProfileRepository'
import { createTestDatabase } from '../db/testing/createTestDatabase'
import { LLMProfileService, type SecretStorage } from '../services/LLMProfileService'
import { LLMProfilesIpcHandlers } from './llmProfiles.handlers'

const createPayload = {
  name: 'Primary',
  protocol: 'openai_chat_completions',
  baseUrl: 'https://llm.example.test/v1',
  modelId: 'model-a',
  timeoutMs: 180_000,
  outputMode: 'json_object',
  language: 'zh-CN',
  maxInputSongs: 100
} as const

describe('LLMProfilesIpcHandlers', () => {
  const databases: Database.Database[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('provides a renderer-safe profile lifecycle with a dedicated secret channel', async () => {
    const { handlers } = createHandlers(databases)

    await expect(handlers.getProtocolOptions()).resolves.toMatchObject({
      success: true,
      data: [{ protocol: 'openai_chat_completions', outputModes: ['json_object', 'prompt_json'] }]
    })
    await expect(handlers.create(createPayload)).resolves.toMatchObject({
      success: true,
      data: { id: 'profile-1', isActive: true, hasApiKey: false }
    })
    await expect(
      handlers.setApiKey({ id: 'profile-1', apiKey: 'renderer-submitted-key' })
    ).resolves.toMatchObject({ success: true })

    const listResult = await handlers.list()
    expect(listResult).toMatchObject({
      success: true,
      data: [{ id: 'profile-1', hasApiKey: true }]
    })
    expect(JSON.stringify(listResult)).not.toMatch(/renderer-submitted-key|secretRef|apiKey/)

    await expect(
      handlers.update({ id: 'profile-1', changes: { name: 'Updated' } })
    ).resolves.toMatchObject({ success: true, data: { name: 'Updated' } })
    await expect(handlers.getActive()).resolves.toMatchObject({
      success: true,
      data: { id: 'profile-1' }
    })
    await expect(handlers.delete({ id: 'profile-1' })).resolves.toEqual({
      success: true,
      data: true
    })
  })

  it('rejects attempts to smuggle a key through profile creation', async () => {
    const { handlers, secrets } = createHandlers(databases)
    const result = await handlers.create({ ...createPayload, apiKey: 'smuggled-key' })

    expect(result).toMatchObject({ success: false, error: 'LLM_PROFILE_INVALID' })
    expect(secrets.size).toBe(0)
    expect(JSON.stringify(result)).not.toContain('smuggled-key')
  })
})

function createHandlers(databases: Database.Database[]): {
  handlers: LLMProfilesIpcHandlers
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
  const service = new LLMProfileService(
    new LLMProfileRepository(db),
    storage,
    () => `profile-${++id}`,
    () => '2026-01-01T00:00:00.000Z'
  )
  return { handlers: new LLMProfilesIpcHandlers(service), secrets }
}
