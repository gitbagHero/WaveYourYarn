import { afterEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { AIDisclosureConsentRepository } from '../db/repositories/AIDisclosureConsentRepository'
import { LLMProfileRepository } from '../db/repositories/LLMProfileRepository'
import { SettingsRepository } from '../db/repositories/SettingsRepository'
import { createTestDatabase } from '../db/testing/createTestDatabase'
import type { AIDisclosurePreview, LLMProfileRecord } from '../types/llm'
import type { MusicAnalysisDataset } from '../types/statistics'
import {
  AIDisclosureService,
  AI_DISCLOSURE_FIELDS_HASH,
  type AIDisclosureAuthorizationScope,
  type AIDisclosureDatasetProvider
} from './AIDisclosureService'
import { SettingsService } from './SettingsService'

describe('AIDisclosureService', () => {
  const databases: Database.Database[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('previews exact fields and issues a short-lived, single-use scope-bound token', async () => {
    const fixture = createFixture(databases)

    const preview = await fixture.service.preview({
      profileId: 'profile-1',
      source: { type: 'liked' }
    })

    expect(fixture.getDataset).toHaveBeenCalledWith({ type: 'liked' }, 40)
    expect(preview).toMatchObject({
      targetOrigin: 'https://llm.example.test',
      songCount: 2,
      maximumSongCount: 40,
      reportLanguage: 'zh-CN',
      fieldsHash: AI_DISCLOSURE_FIELDS_HASH,
      includesNickname: false,
      requiresConfirmation: true,
      matchedRememberedConsent: false
    })
    expect(preview.fields.map(({ path }) => path)).not.toContain('nickname')
    expect(() =>
      fixture.service.authorize({ previewId: preview.previewId, confirmed: false, remember: false })
    ).toThrow('需要明确确认本次数据披露')

    const authorization = fixture.service.authorize({
      previewId: preview.previewId,
      confirmed: true,
      remember: false
    })
    const scope = scopeFromPreview(preview)
    fixture.service.consumeAuthorization(authorization.token, scope)
    expect(() => fixture.service.consumeAuthorization(authorization.token, scope)).toThrow(
      '数据披露授权已过期或已使用'
    )
  })

  it('remembers only a matching scope and lets always-confirm mode override it', async () => {
    const fixture = createFixture(databases)
    const first = await fixture.service.preview({
      profileId: 'profile-1',
      source: { type: 'liked' }
    })
    fixture.service.authorize({ previewId: first.previewId, confirmed: true, remember: true })

    expect(fixture.service.getPreferences()).toEqual({
      confirmationMode: 'allow_remembered',
      rememberedConsentCount: 1
    })
    const remembered = await fixture.service.preview({
      profileId: 'profile-1',
      source: { type: 'liked' }
    })
    expect(remembered).toMatchObject({
      requiresConfirmation: false,
      matchedRememberedConsent: true
    })
    expect(
      fixture.service.authorize({
        previewId: remembered.previewId,
        confirmed: false,
        remember: false
      }).remembered
    ).toBe(true)

    fixture.profiles.update({
      ...fixture.profiles.findById('profile-1')!,
      maxInputSongs: 50,
      updatedAt: '2026-01-01T01:00:00.000Z'
    })
    const expanded = await fixture.service.preview({
      profileId: 'profile-1',
      source: { type: 'liked' }
    })
    expect(expanded.requiresConfirmation).toBe(true)

    await fixture.service.setConfirmationMode('always')
    const always = await fixture.service.preview({
      profileId: 'profile-1',
      source: { type: 'liked' }
    })
    expect(always.requiresConfirmation).toBe(true)
    expect(() =>
      fixture.service.authorize({ previewId: always.previewId, confirmed: true, remember: true })
    ).toThrow('当前设置要求每次确认')
    expect(fixture.service.revokeRememberedConsents().rememberedConsentCount).toBe(0)
  })

  it('invalidates expired previews and tokens whose complete scope does not match', async () => {
    let now = Date.parse('2026-01-01T00:00:00.000Z')
    const fixture = createFixture(databases, () => now)
    const preview = await fixture.service.preview({
      profileId: 'profile-1',
      source: { type: 'liked' }
    })
    now += 10 * 60 * 1_000
    expect(() =>
      fixture.service.authorize({ previewId: preview.previewId, confirmed: true, remember: false })
    ).toThrow('数据披露预览已过期')

    now += 1
    const fresh = await fixture.service.preview({
      profileId: 'profile-1',
      source: { type: 'liked' }
    })
    const authorization = fixture.service.authorize({
      previewId: fresh.previewId,
      confirmed: true,
      remember: false
    })
    expect(() =>
      fixture.service.consumeAuthorization(authorization.token, {
        ...scopeFromPreview(fresh),
        targetOrigin: 'https://changed.example.test'
      })
    ).toThrow('数据披露授权与当前分析范围不匹配')
    expect(() =>
      fixture.service.consumeAuthorization(authorization.token, scopeFromPreview(fresh))
    ).toThrow('数据披露授权已过期或已使用')
  })

  it('refuses to authorize an empty local dataset', async () => {
    const fixture = createFixture(databases, Date.now, datasetFixture(0))
    await expect(
      fixture.service.preview({ profileId: 'profile-1', source: { type: 'liked' } })
    ).rejects.toMatchObject({ code: 'AI_DATASET_EMPTY' })
  })

  it('binds a chosen song limit, language and model identity to the authorization', async () => {
    const fixture = createFixture(databases)
    const preview = await fixture.service.preview({
      profileId: 'profile-1',
      source: { type: 'liked' },
      requestedSongLimit: 20,
      language: 'en-US'
    })

    expect(fixture.getDataset).toHaveBeenCalledWith({ type: 'liked' }, 20)
    expect(preview).toMatchObject({ maximumSongCount: 20, reportLanguage: 'en-US' })
    fixture.profiles.update({
      ...fixture.profiles.findById('profile-1')!,
      modelId: 'changed-model',
      updatedAt: '2026-01-01T01:00:00.000Z'
    })
    expect(() =>
      fixture.service.authorize({
        previewId: preview.previewId,
        confirmed: true,
        remember: false
      })
    ).toThrowError(expect.objectContaining({ code: 'AI_DISCLOSURE_SCOPE_CHANGED' }))
  })
})

function createFixture(
  databases: Database.Database[],
  now: () => number = () => Date.parse('2026-01-01T00:00:00.000Z'),
  dataset = datasetFixture(2)
) {
  const db = createTestDatabase()
  databases.push(db)
  const profiles = new LLMProfileRepository(db)
  profiles.create(profileFixture())
  const getDataset = vi.fn<AIDisclosureDatasetProvider['getAnalysisDataset']>(async () => dataset)
  let id = 0
  const service = new AIDisclosureService(
    profiles,
    new AIDisclosureConsentRepository(db),
    { getAnalysisDataset: getDataset },
    new SettingsService(new SettingsRepository(db)),
    () => `generated-${++id}`,
    now
  )
  return { service, getDataset, profiles }
}

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
    maxInputSongs: 40,
    secretRef: 'llm-profile:profile-1:api-key',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

function datasetFixture(songCount: number): MusicAnalysisDataset {
  const compactSongs = Array.from({ length: songCount }, (_, index) => ({
    ncmSongId: `song-${index}`,
    name: `Song ${index}`,
    artists: ['Artist'],
    orderIndex: index
  }))
  return {
    schemaVersion: 1,
    source: { type: 'liked', name: '我喜欢的音乐', timeField: 'likedAt' },
    scope: {
      selection: 'most_recent',
      requestedSongLimit: 40,
      availableSongCount: songCount,
      includedSongCount: songCount,
      truncated: false,
      timePrecision: songCount ? 'order_only' : 'none'
    },
    summary: {
      source: { type: 'liked', name: '我喜欢的音乐', timeField: 'likedAt' },
      overview: { songCount, uniqueSongCount: songCount, artistCount: 1, albumCount: 0 },
      topArtists: [],
      topAlbums: [],
      timeDistribution: { byYear: [], byMonth: [] },
      recentSongs: [],
      earliestSongs: [],
      generatedAt: '2026-01-01T00:00:00.000Z'
    },
    compactSongs,
    digest: `sha256:${'a'.repeat(64)}`,
    generatedAt: '2026-01-01T00:00:00.000Z'
  }
}

function scopeFromPreview(preview: AIDisclosurePreview): AIDisclosureAuthorizationScope {
  return {
    profileId: preview.profile.id,
    modelId: preview.profile.modelId,
    targetOrigin: preview.targetOrigin,
    protocol: preview.protocol,
    sourceType: preview.source.type,
    sourceId: preview.source.id,
    fieldsHash: preview.fieldsHash,
    songCount: preview.songCount,
    maximumSongCount: preview.maximumSongCount,
    reportLanguage: preview.reportLanguage,
    datasetDigest: preview.datasetDigest
  }
}
