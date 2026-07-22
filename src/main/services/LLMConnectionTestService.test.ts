import { afterEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { LLMProviderError, type LLMChatCompletionRequest } from '../adapters/llm/LLMProvider'
import { LLMProviderRegistry } from '../adapters/llm/LLMProviderRegistry'
import { JobRunRepository } from '../db/repositories/JobRunRepository'
import { LLMProfileRepository } from '../db/repositories/LLMProfileRepository'
import { createTestDatabase } from '../db/testing/createTestDatabase'
import type { JobRun } from '../types/llm'
import { JobManager } from './JobManager'
import { LLMConnectionTestService } from './LLMConnectionTestService'
import { LLMProfileService, type SecretStorage } from './LLMProfileService'

describe('LLMConnectionTestService', () => {
  const databases: Database.Database[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('sends only a fixed ping and records a successful job/profile test', async () => {
    const requestSpy = vi.fn<(request: LLMChatCompletionRequest) => Promise<string>>(async () =>
      Promise.resolve('OK')
    )
    const fixture = await createFixture(databases, requestSpy)

    const created = await fixture.connectionTests.start(fixture.profileId)
    const completed = await waitForTerminal(fixture.jobs, created.id)

    expect(completed).toMatchObject({
      status: 'succeeded',
      inputSummary: { sendsMusicData: false }
    })
    expect(requestSpy).toHaveBeenCalledOnce()
    const request = requestSpy.mock.calls[0]?.[0]
    expect(request?.messages).toEqual([
      {
        role: 'system',
        content: 'This is a connection test. Do not use tools. Reply with exactly OK.'
      },
      { role: 'user', content: 'ping' }
    ])
    expect(JSON.stringify(request)).not.toMatch(/song|artist|album|liked|playlist/i)
    expect(fixture.profiles.findById(fixture.profileId)).toMatchObject({
      lastTestStatus: 'succeeded'
    })
  })

  it('stores only a safe provider failure and marks the profile test failed', async () => {
    const fixture = await createFixture(databases, async () => {
      throw new LLMProviderError('LLM_AUTH_FAILED', '模型服务鉴权失败。', 401)
    })

    const created = await fixture.connectionTests.start(fixture.profileId)
    const completed = await waitForTerminal(fixture.jobs, created.id)

    expect(completed).toMatchObject({
      status: 'failed',
      errorCode: 'LLM_AUTH_FAILED',
      safeMessage: '模型服务鉴权失败。'
    })
    expect(fixture.profiles.findById(fixture.profileId)).toMatchObject({
      lastTestStatus: 'failed'
    })
  })

  it('reuses an unfinished profile test instead of starting a duplicate request', async () => {
    let resolveRequest: ((value: string) => void) | undefined
    const request = new Promise<string>((resolve) => {
      resolveRequest = resolve
    })
    const requestSpy = vi.fn(async () => request)
    const fixture = await createFixture(databases, requestSpy)

    const first = await fixture.connectionTests.start(fixture.profileId)
    const second = await fixture.connectionTests.start(fixture.profileId)

    expect(second.id).toBe(first.id)
    expect(requestSpy).toHaveBeenCalledOnce()
    resolveRequest?.('OK')
    await waitForTerminal(fixture.jobs, first.id)
  })
})

async function createFixture(
  databases: Database.Database[],
  createChatCompletion: (request: LLMChatCompletionRequest) => Promise<string>
): Promise<{
  connectionTests: LLMConnectionTestService
  jobs: JobRunRepository
  profiles: LLMProfileRepository
  profileId: string
}> {
  const db = createTestDatabase()
  databases.push(db)
  const profiles = new LLMProfileRepository(db)
  const jobs = new JobRunRepository(db)
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
  let tick = 0
  const clock = (): string => `2026-01-01T00:00:${String(tick++).padStart(2, '0')}.000Z`
  const profileService = new LLMProfileService(profiles, storage, () => 'profile-1', clock)
  const profile = await profileService.create({
    name: 'Test profile',
    baseUrl: 'https://llm.example.test/v1',
    modelId: 'model-a',
    outputMode: 'json_object',
    apiKey: 'fake-key'
  })
  const registry = new LLMProviderRegistry()
  registry.register('openai_chat_completions', () => ({ createChatCompletion }))
  return {
    connectionTests: new LLMConnectionTestService(
      profileService,
      profiles,
      jobs,
      new JobManager(jobs, () => 'job-1', clock),
      registry,
      clock
    ),
    jobs,
    profiles,
    profileId: profile.id
  }
}

async function waitForTerminal(repository: JobRunRepository, id: string): Promise<JobRun> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const job = repository.findById(id)
    if (job && !['pending', 'running'].includes(job.status)) {
      return job
    }
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  throw new Error('Connection test did not reach a terminal state.')
}
