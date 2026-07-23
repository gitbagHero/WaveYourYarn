import { afterEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { LLMProviderError, type LLMChatCompletionRequest } from '../adapters/llm/LLMProvider'
import { LLMProviderRegistry } from '../adapters/llm/LLMProviderRegistry'
import { AIDisclosureConsentRepository } from '../db/repositories/AIDisclosureConsentRepository'
import { AIReportRepository } from '../db/repositories/AIReportRepository'
import { AIReportSourceRepository } from '../db/repositories/AIReportSourceRepository'
import { JobRunRepository } from '../db/repositories/JobRunRepository'
import { LLMProfileRepository } from '../db/repositories/LLMProfileRepository'
import { SettingsRepository } from '../db/repositories/SettingsRepository'
import { createTestDatabase } from '../db/testing/createTestDatabase'
import type { JobRun } from '../types/llm'
import type { MusicAnalysisDataset } from '../types/statistics'
import { AIDisclosureService, type AIDisclosureDatasetProvider } from './AIDisclosureService'
import { AIReportGenerationService } from './AIReportGenerationService'
import { JobManager } from './JobManager'
import { LLMProfileService, type SecretStorage } from './LLMProfileService'
import { SettingsService } from './SettingsService'

describe('AIReportGenerationService', () => {
  const databases: Database.Database[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('uses one disclosure authorization and atomically persists a validated report', async () => {
    const requestSpy = vi.fn<(request: LLMChatCompletionRequest) => Promise<string>>(async () =>
      JSON.stringify(validReportFixture())
    )
    const fixture = await createFixture(databases, requestSpy)

    const created = await fixture.startAuthorized()
    const completed = await waitForTerminal(fixture.jobs, created.id)

    expect(completed).toMatchObject({
      status: 'succeeded',
      stage: 'completed',
      progressCurrent: 4,
      progressTotal: 4,
      inputSummary: {
        sourceType: 'liked',
        songCount: 1,
        maximumSongCount: 100,
        datasetDigest: `sha256:${'a'.repeat(64)}`,
        language: 'zh-CN'
      }
    })
    expect(JSON.stringify(completed.inputSummary)).not.toContain('Song 1')
    expect(requestSpy).toHaveBeenCalledOnce()
    expect(requestSpy.mock.calls[0]?.[0]).toMatchObject({
      maxTokens: 5_000,
      responseFormat: 'json_object'
    })
    expect(requestSpy.mock.calls[0]?.[0].messages[1]?.content).toContain('"reportLanguage":"zh-CN"')

    const report = fixture.reports.findByJobId(created.id)
    expect(report).toMatchObject({
      userTitle: '测试音乐报告',
      status: 'succeeded',
      contentSchemaVersion: 1,
      protocol: 'openai_chat_completions',
      providerOrigin: 'https://llm.example.test',
      modelId: 'model-a',
      promptTemplateVersion: 2,
      datasetDigest: `sha256:${'a'.repeat(64)}`
    })
    expect(JSON.stringify(report)).not.toContain('fake-api-key')
    expect(fixture.sources.findByReportId(report!.id)).toEqual([
      expect.objectContaining({
        reportId: report!.id,
        sourceType: 'liked',
        songIds: ['song-1'],
        includedSongCount: 1,
        datasetDigest: report!.datasetDigest
      })
    ])
  })

  it('records invalid provider output as a safe failure without saving artifacts', async () => {
    const fixture = await createFixture(databases, async () => '{}')

    const created = await fixture.startAuthorized()
    const completed = await waitForTerminal(fixture.jobs, created.id)

    expect(completed).toMatchObject({
      status: 'failed',
      errorCode: 'LLM_OUTPUT_INVALID',
      safeMessage: '模型返回的报告格式不符合要求。'
    })
    expect(fixture.reports.count(true)).toBe(0)
    expect(fixture.sources.count()).toBe(0)
  })

  it('preserves a safe provider error and saves no report', async () => {
    const fixture = await createFixture(databases, async () => {
      throw new LLMProviderError('LLM_AUTH_FAILED', '模型服务鉴权失败。', 401)
    })

    const created = await fixture.startAuthorized()
    const completed = await waitForTerminal(fixture.jobs, created.id)

    expect(completed).toMatchObject({
      status: 'failed',
      errorCode: 'LLM_AUTH_FAILED',
      safeMessage: '模型服务鉴权失败。'
    })
    expect(fixture.reports.count(true)).toBe(0)
  })

  it('keeps cancellation terminal even if the provider request is still pending', async () => {
    const fixture = await createFixture(
      databases,
      (request) =>
        new Promise<string>((_resolve, reject) => {
          request.signal?.addEventListener('abort', () => {
            reject(new LLMProviderError('LLM_CANCELLED', '模型请求已取消。'))
          })
        })
    )

    const created = await fixture.startAuthorized()
    expect(fixture.manager.cancel(created.id)).toBe(true)
    const completed = await waitForTerminal(fixture.jobs, created.id)

    expect(completed).toMatchObject({ status: 'cancelled', errorCode: 'LLM_CANCELLED' })
    expect(fixture.reports.count(true)).toBe(0)
  })

  it('rolls back both job success and report insert when source persistence fails', async () => {
    const fixture = await createFixture(
      databases,
      async () => JSON.stringify(validReportFixture()),
      true
    )

    const created = await fixture.startAuthorized()
    const completed = await waitForTerminal(fixture.jobs, created.id)

    expect(completed).toMatchObject({ status: 'failed', errorCode: 'JOB_FAILED' })
    expect(fixture.reports.count(true)).toBe(0)
    expect(fixture.sources.count()).toBe(0)
  })

  it('requires a fresh authorization and creates a new linked job when retrying', async () => {
    let attempt = 0
    const fixture = await createFixture(databases, async () => {
      attempt += 1
      return attempt === 1 ? '{}' : JSON.stringify(validReportFixture())
    })

    const first = await fixture.startAuthorized()
    expect(await waitForTerminal(fixture.jobs, first.id)).toMatchObject({ status: 'failed' })

    const retry = await fixture.startAuthorized(first.id)
    expect(await waitForTerminal(fixture.jobs, retry.id)).toMatchObject({
      status: 'succeeded',
      retryOfJobId: first.id
    })
    expect(retry.id).not.toBe(first.id)
    expect(fixture.reports.findByJobId(first.id)).toBeNull()
    expect(fixture.reports.findByJobId(retry.id)).not.toBeNull()
  })
})

async function createFixture(
  databases: Database.Database[],
  createChatCompletion: (request: LLMChatCompletionRequest) => Promise<string>,
  failSourcePersistence = false
) {
  const db = createTestDatabase()
  databases.push(db)
  const profiles = new LLMProfileRepository(db)
  const jobs = new JobRunRepository(db)
  const reports = new AIReportRepository(db)
  const sources = failSourcePersistence
    ? new (class extends AIReportSourceRepository {
        override create(): void {
          throw new Error('source persistence failed')
        }
      })(db)
    : new AIReportSourceRepository(db)
  const secrets = new Map<string, string>()
  const secretStorage: SecretStorage = {
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
  const profileService = new LLMProfileService(
    profiles,
    secretStorage,
    () => 'profile-1',
    () => '2026-01-01T00:00:00.000Z'
  )
  await profileService.create({
    name: 'Test profile',
    baseUrl: 'https://llm.example.test/v1',
    modelId: 'model-a',
    outputMode: 'json_object',
    language: 'zh-CN',
    maxInputSongs: 100,
    apiKey: 'fake-api-key'
  })

  const dataset = datasetFixture()
  const datasetProvider: AIDisclosureDatasetProvider = {
    async getAnalysisDataset() {
      return dataset
    }
  }
  let disclosureId = 0
  const disclosure = new AIDisclosureService(
    profiles,
    new AIDisclosureConsentRepository(db),
    datasetProvider,
    new SettingsService(new SettingsRepository(db)),
    () => `disclosure-${++disclosureId}`,
    () => Date.parse('2026-01-01T00:00:00.000Z')
  )
  let jobId = 0
  let jobTick = 1
  const manager = new JobManager(
    jobs,
    () => `job-${++jobId}`,
    () => `2026-01-01T00:00:${String(jobTick++).padStart(2, '0')}.000Z`
  )
  const providers = new LLMProviderRegistry()
  providers.register('openai_chat_completions', () => ({ createChatCompletion }))
  let artifactId = 0
  const service = new AIReportGenerationService(
    profileService,
    disclosure,
    datasetProvider,
    manager,
    providers,
    reports,
    sources,
    () => `artifact-${++artifactId}`,
    () => '2026-01-01T00:00:10.000Z'
  )

  return {
    jobs,
    manager,
    reports,
    sources,
    async startAuthorized(retryOfJobId?: string): Promise<JobRun> {
      const preview = await disclosure.preview({
        profileId: 'profile-1',
        source: { type: 'liked' }
      })
      const authorization = disclosure.authorize({
        previewId: preview.previewId,
        confirmed: true,
        remember: false
      })
      return service.start({
        profileId: 'profile-1',
        source: { type: 'liked' },
        authorizationToken: authorization.token,
        retryOfJobId
      })
    }
  }
}

async function waitForTerminal(repository: JobRunRepository, id: string): Promise<JobRun> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const job = repository.findById(id)
    if (job && !['pending', 'running'].includes(job.status)) {
      return job
    }
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  throw new Error('AI report generation did not reach a terminal state.')
}

function datasetFixture(): MusicAnalysisDataset {
  const generatedAt = '2026-01-01T00:00:00.000Z'
  return {
    schemaVersion: 1,
    source: { type: 'liked', name: '我喜欢的音乐', timeField: 'likedAt' },
    scope: {
      selection: 'most_recent',
      requestedSongLimit: 100,
      availableSongCount: 1,
      includedSongCount: 1,
      truncated: false,
      timePrecision: 'order_only'
    },
    summary: {
      source: { type: 'liked', name: '我喜欢的音乐', timeField: 'likedAt' },
      overview: { songCount: 1, uniqueSongCount: 1, artistCount: 1, albumCount: 1 },
      topArtists: [],
      topAlbums: [],
      timeDistribution: { byYear: [], byMonth: [] },
      recentSongs: [],
      earliestSongs: [],
      generatedAt
    },
    compactSongs: [
      {
        ncmSongId: 'song-1',
        name: 'Song 1',
        artists: ['Artist'],
        album: 'Album',
        orderIndex: 0
      }
    ],
    digest: `sha256:${'a'.repeat(64)}`,
    generatedAt
  }
}

function validReportFixture(): Record<string, unknown> {
  const evidence = { songIds: ['song-1'], factKeys: ['sample.songCount'] }
  return {
    schemaVersion: 1,
    title: '测试音乐报告',
    subtitle: '基于最近收藏样本',
    tasteSnapshot: {
      summary: '这是一段用于验证持久化链路的音乐偏好摘要。',
      keywords: ['探索', '专注']
    },
    listeningArchetype: {
      name: '旋律探索者',
      description: '你可能倾向于在熟悉与探索之间保持弹性。',
      confidence: 'medium',
      evidence
    },
    dimensions: [
      'exploration_familiarity',
      'focus_variety',
      'collection_rhythm',
      'emotional_texture'
    ].map((key) => ({
      key,
      title: key,
      tendency: '测试倾向',
      description: '这是基于有限收藏样本形成的低置信度描述。',
      confidence: 'low',
      evidence
    })),
    moodsAndScenes: [
      { title: '独处', description: '可能适合安静独处。', confidence: 'low', evidence }
    ],
    notablePatterns: [
      { title: '集中', description: '样本呈现一定集中度。', confidence: 'high', evidence }
    ],
    personalityReflections: [
      { title: '开放', description: '可能愿意保留探索空间。', confidence: 'low', evidence }
    ],
    limitations: ['样本有限。', '不包含完整播放历史。']
  }
}
