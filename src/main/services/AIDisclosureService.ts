import { createHash } from 'node:crypto'
import { nanoid } from 'nanoid'
import { getDatabase } from '../db/database'
import {
  AIDisclosureConsentRepository,
  type AIDisclosureConsentScope
} from '../db/repositories/AIDisclosureConsentRepository'
import { LLMProfileRepository } from '../db/repositories/LLMProfileRepository'
import { StatisticsRepository } from '../db/repositories/StatisticsRepository'
import type {
  AIDisclosureAuthorization,
  AIDisclosureField,
  AIDisclosurePreferences,
  AIDisclosurePreview,
  AIDisclosurePreviewRequest,
  AIDisclosureSourceType,
  AuthorizeAIDisclosureRequest,
  LLMProfileRecord,
  LLMProtocol
} from '../types/llm'
import type { MusicAnalysisDataset, StatisticsSource } from '../types/statistics'
import type { AIDisclosureConfirmationMode } from '../types/settings'
import { StatisticsService } from './StatisticsService'
import {
  AI_DISCLOSURE_CONFIRMATION_MODE_KEY,
  DEFAULT_AI_DISCLOSURE_CONFIRMATION_MODE,
  SettingsService
} from './SettingsService'

const PREVIEW_TTL_MS = 10 * 60 * 1_000
const AUTHORIZATION_TTL_MS = 5 * 60 * 1_000

export const AI_DISCLOSURE_FIELDS: readonly AIDisclosureField[] = [
  { path: 'schemaVersion', label: '分析数据契约版本' },
  { path: 'source.{type,id,name,timeField}', label: '来源类型、名称与时间字段说明' },
  { path: 'scope.*', label: '选取方式、歌曲数量、截断情况与时间精度' },
  { path: 'summary.overview.*', label: '歌曲、歌手、专辑与时间范围汇总' },
  { path: 'summary.topArtists[]', label: '高频歌手、占比与样本歌曲 ID/名称' },
  { path: 'summary.topAlbums[]', label: '高频专辑、占比与样本歌曲 ID/名称' },
  { path: 'summary.timeDistribution.*', label: '按年和按月的收藏时间分布' },
  { path: 'summary.{recentSongs,earliestSongs}[]', label: '近期与早期歌曲摘要' },
  { path: 'summary.playlistOverview.*', label: '全部来源时的本地歌单数量汇总' },
  {
    path: 'compactSongs[].{ncmSongId,name,artists,album,time,orderIndex}',
    label: '歌曲 ID、名称、歌手、专辑与可用的收藏顺序/时间'
  },
  { path: '{digest,generatedAt}', label: '数据摘要校验值与本地生成时间' }
]

export const AI_DISCLOSURE_FIELDS_HASH = `sha256:${createHash('sha256')
  .update(JSON.stringify(AI_DISCLOSURE_FIELDS.map(({ path }) => path)))
  .digest('hex')}`

export interface AIDisclosureDatasetProvider {
  getAnalysisDataset(
    source: StatisticsSource,
    requestedSongLimit?: number
  ): Promise<MusicAnalysisDataset>
}

export interface AIDisclosureAuthorizationScope {
  profileId: string
  targetOrigin: string
  protocol: LLMProtocol
  sourceType: AIDisclosureSourceType
  sourceId?: string
  fieldsHash: string
  songCount: number
  maximumSongCount: number
  datasetDigest: string
}

export type AIDisclosureErrorCode =
  | 'AI_DATASET_EMPTY'
  | 'AI_DISCLOSURE_EXPIRED'
  | 'AI_DISCLOSURE_CONFIRMATION_REQUIRED'
  | 'AI_DISCLOSURE_SCOPE_CHANGED'
  | 'AI_DISCLOSURE_MODE_INVALID'

export class AIDisclosureError extends Error {
  constructor(
    readonly code: AIDisclosureErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'AIDisclosureError'
  }
}

interface PendingPreview {
  scope: AIDisclosureAuthorizationScope
  expiresAt: number
  requiresConfirmation: boolean
  matchedRememberedConsent: boolean
}

interface PendingAuthorization {
  scope: AIDisclosureAuthorizationScope
  expiresAt: number
}

export class AIDisclosureService {
  private readonly previews = new Map<string, PendingPreview>()
  private readonly authorizations = new Map<string, PendingAuthorization>()

  constructor(
    private readonly profiles = new LLMProfileRepository(),
    private readonly consents = new AIDisclosureConsentRepository(),
    private readonly datasets: AIDisclosureDatasetProvider = new StatisticsService(
      new StatisticsRepository(getDatabase())
    ),
    private readonly settings = new SettingsService(),
    private readonly createId: () => string = nanoid,
    private readonly now: () => number = Date.now
  ) {}

  async preview(request: AIDisclosurePreviewRequest): Promise<AIDisclosurePreview> {
    this.removeExpiredEntries()
    const profile = this.profiles.findById(request.profileId)
    if (!profile) {
      throw new AIDisclosureError('AI_DISCLOSURE_SCOPE_CHANGED', '模型配置不存在或已发生变化')
    }

    const source = toStatisticsSource(request.source)
    const dataset = await this.datasets.getAnalysisDataset(source, profile.maxInputSongs)
    if (dataset.scope.includedSongCount === 0) {
      throw new AIDisclosureError('AI_DATASET_EMPTY', '当前来源没有可用于分析的歌曲')
    }

    const scope = createAIDisclosureAuthorizationScope(profile, dataset)
    const confirmationMode = this.getConfirmationMode()
    const matchedRememberedConsent =
      confirmationMode === 'allow_remembered' &&
      Boolean(this.consents.findMatching(toConsentScope(scope)))
    const previewId = this.createId()
    const expiresAt = this.now() + PREVIEW_TTL_MS
    this.previews.set(previewId, {
      scope,
      expiresAt,
      requiresConfirmation: !matchedRememberedConsent,
      matchedRememberedConsent
    })

    return {
      previewId,
      expiresAt: toIso(expiresAt),
      profile: { id: profile.id, name: profile.name, modelId: profile.modelId },
      targetOrigin: scope.targetOrigin,
      protocol: profile.protocol,
      source: {
        type: dataset.source.type,
        id: dataset.source.id,
        name: dataset.source.name
      },
      songCount: dataset.scope.includedSongCount,
      maximumSongCount: profile.maxInputSongs,
      fields: AI_DISCLOSURE_FIELDS.map((field) => ({ ...field })),
      fieldsHash: AI_DISCLOSURE_FIELDS_HASH,
      datasetDigest: dataset.digest,
      includesNickname: false,
      requiresConfirmation: !matchedRememberedConsent,
      matchedRememberedConsent,
      notices: [
        '确认后，所列音乐数据将发送到所选模型服务；连接测试不会发送这些数据。',
        '远端服务收到数据后无法由本应用撤回，请同时遵守所选服务的隐私条款。',
        '模型调用可能产生费用；取消等待不代表服务商一定不会计费。',
        '本版本只验证披露授权流程，不会因此预览或确认动作自动上传数据。'
      ]
    }
  }

  authorize(request: AuthorizeAIDisclosureRequest): AIDisclosureAuthorization {
    this.removeExpiredEntries()
    const preview = this.previews.get(request.previewId)
    if (!preview) {
      throw new AIDisclosureError('AI_DISCLOSURE_EXPIRED', '数据披露预览已过期，请重新预览')
    }
    const rememberedConsentStillMatches =
      this.getConfirmationMode() === 'allow_remembered' &&
      Boolean(this.consents.findMatching(toConsentScope(preview.scope)))
    const requiresConfirmation =
      preview.requiresConfirmation ||
      (preview.matchedRememberedConsent && !rememberedConsentStillMatches)
    if (requiresConfirmation && !request.confirmed) {
      throw new AIDisclosureError('AI_DISCLOSURE_CONFIRMATION_REQUIRED', '需要明确确认本次数据披露')
    }

    const profile = this.profiles.findById(preview.scope.profileId)
    if (
      !profile ||
      new URL(profile.baseUrl).origin !== preview.scope.targetOrigin ||
      profile.protocol !== preview.scope.protocol ||
      profile.maxInputSongs !== preview.scope.maximumSongCount
    ) {
      this.previews.delete(request.previewId)
      throw new AIDisclosureError(
        'AI_DISCLOSURE_SCOPE_CHANGED',
        '模型配置或披露范围已发生变化，请重新预览'
      )
    }

    if (request.remember) {
      if (!request.confirmed) {
        throw new AIDisclosureError(
          'AI_DISCLOSURE_CONFIRMATION_REQUIRED',
          '只有明确确认后才能记住授权'
        )
      }
      if (this.getConfirmationMode() !== 'allow_remembered') {
        throw new AIDisclosureError(
          'AI_DISCLOSURE_MODE_INVALID',
          '当前设置要求每次确认，不能记住本次授权'
        )
      }
      const timestamp = toIso(this.now())
      this.consents.remember({
        id: this.createId(),
        ...toConsentScope(preview.scope),
        createdAt: timestamp,
        updatedAt: timestamp
      })
    }

    this.previews.delete(request.previewId)
    const token = this.createId()
    const expiresAt = this.now() + AUTHORIZATION_TTL_MS
    this.authorizations.set(token, { scope: preview.scope, expiresAt })
    return {
      token,
      expiresAt: toIso(expiresAt),
      remembered: request.remember || (!requiresConfirmation && rememberedConsentStillMatches)
    }
  }

  consumeAuthorization(token: string, expectedScope: AIDisclosureAuthorizationScope): void {
    this.removeExpiredEntries()
    const authorization = this.authorizations.get(token)
    this.authorizations.delete(token)
    if (!authorization) {
      throw new AIDisclosureError('AI_DISCLOSURE_EXPIRED', '数据披露授权已过期或已使用')
    }
    if (!sameScope(authorization.scope, expectedScope)) {
      throw new AIDisclosureError('AI_DISCLOSURE_SCOPE_CHANGED', '数据披露授权与当前分析范围不匹配')
    }
  }

  getPreferences(): AIDisclosurePreferences {
    return {
      confirmationMode: this.getConfirmationMode(),
      rememberedConsentCount: this.consents.count()
    }
  }

  async setConfirmationMode(mode: AIDisclosureConfirmationMode): Promise<AIDisclosurePreferences> {
    await this.settings.set(AI_DISCLOSURE_CONFIRMATION_MODE_KEY, mode)
    return this.getPreferences()
  }

  revokeRememberedConsents(): AIDisclosurePreferences {
    this.consents.deleteAll()
    return this.getPreferences()
  }

  private getConfirmationMode(): AIDisclosureConfirmationMode {
    const mode = this.settings.get(AI_DISCLOSURE_CONFIRMATION_MODE_KEY)
    return mode === 'always' || mode === 'allow_remembered'
      ? mode
      : DEFAULT_AI_DISCLOSURE_CONFIRMATION_MODE
  }

  private removeExpiredEntries(): void {
    const currentTime = this.now()
    for (const [id, preview] of this.previews) {
      if (preview.expiresAt <= currentTime) {
        this.previews.delete(id)
      }
    }
    for (const [token, authorization] of this.authorizations) {
      if (authorization.expiresAt <= currentTime) {
        this.authorizations.delete(token)
      }
    }
  }
}

export function createAIDisclosureAuthorizationScope(
  profile: Pick<LLMProfileRecord, 'id' | 'baseUrl' | 'protocol' | 'maxInputSongs'>,
  dataset: MusicAnalysisDataset
): AIDisclosureAuthorizationScope {
  return {
    profileId: profile.id,
    targetOrigin: new URL(profile.baseUrl).origin,
    protocol: profile.protocol,
    sourceType: dataset.source.type,
    sourceId: dataset.source.id,
    fieldsHash: AI_DISCLOSURE_FIELDS_HASH,
    songCount: dataset.scope.includedSongCount,
    maximumSongCount: profile.maxInputSongs,
    datasetDigest: dataset.digest
  }
}

function toStatisticsSource(source: AIDisclosurePreviewRequest['source']): StatisticsSource {
  if (source.type === 'liked' || source.type === 'all') {
    return { type: source.type }
  }
  return { type: 'playlist', playlistId: source.playlistId! }
}

function toConsentScope(scope: AIDisclosureAuthorizationScope): AIDisclosureConsentScope {
  return {
    profileId: scope.profileId,
    targetOrigin: scope.targetOrigin,
    protocol: scope.protocol,
    sourceType: scope.sourceType,
    sourceId: scope.sourceId,
    fieldsHash: scope.fieldsHash,
    maxInputSongs: scope.maximumSongCount
  }
}

function sameScope(
  actual: AIDisclosureAuthorizationScope,
  expected: AIDisclosureAuthorizationScope
): boolean {
  return (
    actual.profileId === expected.profileId &&
    actual.targetOrigin === expected.targetOrigin &&
    actual.protocol === expected.protocol &&
    actual.sourceType === expected.sourceType &&
    actual.sourceId === expected.sourceId &&
    actual.fieldsHash === expected.fieldsHash &&
    actual.songCount === expected.songCount &&
    actual.maximumSongCount === expected.maximumSongCount &&
    actual.datasetDigest === expected.datasetDigest
  )
}

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString()
}
