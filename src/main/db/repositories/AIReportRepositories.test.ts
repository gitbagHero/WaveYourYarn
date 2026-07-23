import { afterEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type {
  AIReportContentV1,
  AIReportSourceRecord,
  NewAIReportRecord
} from '../../types/aiReport'
import type { JobRun, LLMProfileRecord } from '../../types/llm'
import type { MusicStatsSummary } from '../../types/statistics'
import {
  CacheOwnershipService,
  CACHE_OWNER_NCM_USER_ID_KEY
} from '../../services/CacheOwnershipService'
import { createTestDatabase } from '../testing/createTestDatabase'
import { AIReportRepository } from './AIReportRepository'
import { AIReportSourceRepository } from './AIReportSourceRepository'
import { ExportRecordRepository } from './ExportRecordRepository'
import { JobRunRepository } from './JobRunRepository'
import { LLMProfileRepository } from './LLMProfileRepository'
import { PlaylistRepository } from './PlaylistRepository'
import { SettingsRepository } from './SettingsRepository'
import { SongRepository } from './SongRepository'
import { UserRepository } from './UserRepository'

describe('AI report repositories', () => {
  const databases: Database.Database[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('stores auditable reports and keeps deletion isolated from sources and music cache', () => {
    const db = createTestDatabase()
    databases.push(db)
    const profiles = new LLMProfileRepository(db)
    const jobs = new JobRunRepository(db)
    const reports = new AIReportRepository(db)
    const sources = new AIReportSourceRepository(db)
    const settings = new SettingsRepository(db)
    const playlists = new PlaylistRepository(db)
    const songs = new SongRepository(db)
    const exports = new ExportRecordRepository(db)
    const users = new UserRepository(db)

    profiles.create(profileFixture())
    jobs.create(jobFixture('job-1'))
    jobs.create(jobFixture('job-2'))
    reports.create(reportFixture('report-1', 'job-1', '2026-01-01T00:00:01.000Z'))
    reports.create(reportFixture('report-2', 'job-2', '2026-01-02T00:00:01.000Z'))
    sources.create(sourceFixture('source-1', 'report-1'))
    sources.create(sourceFixture('source-2', 'report-2'))

    expect(reports.findAll().map(({ id }) => id)).toEqual(['report-2', 'report-1'])
    expect(sources.findByReportId('report-1')).toEqual([sourceFixture('source-1', 'report-1')])
    expect(reports.rename('report-1', '重命名后的报告', '2026-01-03T00:00:00.000Z')).toBe(true)
    expect(reports.findById('report-1')?.userTitle).toBe('重命名后的报告')

    songs.upsertSong({
      id: 'cached-song',
      ncmSongId: '1001',
      name: 'Cached song',
      artists: ['Artist'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    playlists.upsertPlaylist({
      id: 'cached-playlist',
      ncmPlaylistId: '2001',
      name: 'Cached playlist',
      ownerUserId: 'old-owner',
      type: 'liked',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })

    expect(reports.softDelete('report-1', '2026-01-04T00:00:00.000Z')).toBe(true)
    expect(reports.softDelete('report-1', '2026-01-04T00:00:01.000Z')).toBe(false)
    expect(reports.findById('report-1')).toBeNull()
    expect(reports.findById('report-1', true)?.deletedAt).toBe('2026-01-04T00:00:00.000Z')
    expect(reports.count()).toBe(1)
    expect(reports.count(true)).toBe(2)
    expect(sources.findByReportId('report-1')).toHaveLength(1)
    expect(reports.findById('report-2')).not.toBeNull()
    expect(songs.count()).toBe(1)
    expect(playlists.count()).toBe(1)

    settings.set(CACHE_OWNER_NCM_USER_ID_KEY, 'old-owner')

    const ownership = new CacheOwnershipService(settings, playlists, songs, exports, users, db)
    expect(ownership.ensureOwner('new-owner')).toEqual({ cacheReset: true })
    expect(songs.count()).toBe(0)
    expect(playlists.count()).toBe(0)
    expect(reports.count(true)).toBe(2)
    expect(sources.count()).toBe(2)

    expect(profiles.deleteById('profile-1', '2026-01-05T00:00:00.000Z')).toBe(true)
    expect(reports.findById('report-2')).toMatchObject({
      id: 'report-2',
      jobId: 'job-2'
    })
    expect(reports.findById('report-2')?.profileId).toBeUndefined()
    expect(sources.findByReportId('report-2')).toHaveLength(1)
  })

  it('rejects a source snapshot that does not belong to an existing report', () => {
    const db = createTestDatabase()
    databases.push(db)
    const sources = new AIReportSourceRepository(db)

    expect(() => sources.create(sourceFixture('source-orphan', 'missing-report'))).toThrow()
  })

  it('binds reports to successful jobs and source snapshots to the same dataset digest', () => {
    const db = createTestDatabase()
    databases.push(db)
    const profiles = new LLMProfileRepository(db)
    const jobs = new JobRunRepository(db)
    const reports = new AIReportRepository(db)
    const sources = new AIReportSourceRepository(db)
    profiles.create(profileFixture())
    jobs.create({ ...jobFixture('failed-job'), status: 'failed', stage: 'failed' })

    expect(() =>
      reports.create(reportFixture('failed-report', 'failed-job', '2026-01-01T00:00:01.000Z'))
    ).toThrow('AI report requires a matching successful generation job')

    jobs.create(jobFixture('successful-job'))
    reports.create(reportFixture('successful-report', 'successful-job', '2026-01-01T00:00:02.000Z'))
    expect(() =>
      sources.create({
        ...sourceFixture('mismatched-source', 'successful-report'),
        datasetDigest: `sha256:${'b'.repeat(64)}`
      })
    ).toThrow('AI report source digest does not match its report')

    jobs.create(jobFixture('invalid-content-job'))
    const invalidContentReport = reportFixture(
      'invalid-content-report',
      'invalid-content-job',
      '2026-01-01T00:00:03.000Z'
    )
    invalidContentReport.content = {
      ...invalidContentReport.content,
      schemaVersion: 2 as 1
    }
    expect(() => reports.create(invalidContentReport)).toThrow()
  })
})

function profileFixture(): LLMProfileRecord {
  return {
    id: 'profile-1',
    name: 'Test profile',
    protocol: 'openai_chat_completions',
    baseUrl: 'https://llm.example.test/v1/',
    modelId: 'test-model',
    timeoutMs: 60_000,
    outputMode: 'json_object',
    language: 'zh-CN',
    maxInputSongs: 100,
    secretRef: 'llm-profile:profile-1:api-key',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

function jobFixture(id: string): JobRun {
  return {
    id,
    kind: 'ai_report_generation',
    profileId: 'profile-1',
    status: 'succeeded',
    stage: 'completed',
    inputSummary: { datasetDigest: `sha256:${'a'.repeat(64)}` },
    createdAt: '2026-01-01T00:00:00.000Z',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z'
  }
}

function reportFixture(id: string, jobId: string, generatedAt: string): NewAIReportRecord {
  return {
    id,
    jobId,
    profileId: 'profile-1',
    userTitle: `报告 ${id}`,
    status: 'succeeded',
    contentSchemaVersion: 1,
    protocol: 'openai_chat_completions',
    providerOrigin: 'https://llm.example.test',
    modelId: 'test-model',
    promptTemplateVersion: 1,
    datasetDigest: `sha256:${'a'.repeat(64)}`,
    content: reportContentFixture(),
    generatedAt,
    createdAt: generatedAt,
    updatedAt: generatedAt
  }
}

function sourceFixture(id: string, reportId: string): AIReportSourceRecord {
  return {
    id,
    reportId,
    sourceType: 'liked',
    sourceName: '我喜欢的音乐',
    datasetSchemaVersion: 1,
    selection: 'most_recent',
    requestedSongLimit: 100,
    availableSongCount: 1,
    includedSongCount: 1,
    truncated: false,
    timePrecision: 'source_timestamp',
    songIds: ['1001'],
    summary: summaryFixture(),
    datasetDigest: `sha256:${'a'.repeat(64)}`,
    generatedAt: '2026-01-01T00:00:00.000Z'
  }
}

function summaryFixture(): MusicStatsSummary {
  return {
    source: {
      type: 'liked',
      name: '我喜欢的音乐',
      timeField: 'likedAt'
    },
    overview: {
      songCount: 1,
      uniqueSongCount: 1,
      artistCount: 1,
      albumCount: 1
    },
    topArtists: [],
    topAlbums: [],
    timeDistribution: { byYear: [], byMonth: [] },
    recentSongs: [],
    earliestSongs: [],
    generatedAt: '2026-01-01T00:00:00.000Z'
  }
}

function reportContentFixture(): AIReportContentV1 {
  const evidence = { songIds: ['1001'], factKeys: ['sample.songCount'] }
  return {
    schemaVersion: 1,
    title: '测试报告',
    subtitle: '最近收藏样本',
    tasteSnapshot: {
      summary: '测试摘要',
      keywords: ['测试', '样本'],
      evidence: { songIds: ['song-1'], factKeys: ['sample.songCount'] }
    },
    listeningArchetype: {
      name: '探索者',
      description: '测试描述',
      confidence: 'medium',
      evidence
    },
    dimensions: [
      'exploration_familiarity',
      'focus_variety',
      'collection_rhythm',
      'emotional_texture'
    ].map((key) => ({
      key: key as AIReportContentV1['dimensions'][number]['key'],
      title: key,
      tendency: '测试倾向',
      description: '测试描述',
      confidence: 'low' as const,
      evidence
    })),
    moodsAndScenes: [{ title: '场景', description: '测试描述', confidence: 'low', evidence }],
    notablePatterns: [{ title: '模式', description: '测试描述', confidence: 'high', evidence }],
    personalityReflections: [
      { title: '反思', description: '测试描述', confidence: 'low', evidence }
    ],
    limitations: ['仅供测试', '不是完整播放历史']
  }
}
