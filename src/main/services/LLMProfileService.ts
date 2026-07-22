import { nanoid } from 'nanoid'
import { LLMProfileRepository } from '../db/repositories/LLMProfileRepository'
import {
  LLM_OUTPUT_MODES,
  LLM_PROTOCOLS,
  isLLMOutputModeSupported,
  type LLMOutputMode,
  type LLMProfileRecord,
  type LLMProtocol,
  type PublicLLMProfile
} from '../types/llm'
import { nowIso } from '../utils/time'
import { normalizeExternalBaseUrl } from '../security/externalUrlPolicy'
import { SecureStorageService } from './SecureStorageService'

const DEFAULT_TIMEOUT_MS = 180_000
const DEFAULT_MAX_INPUT_SONGS = 100

export interface SecretStorage {
  setSecret(key: string, value: string): Promise<void>
  getSecret(key: string): Promise<string | null>
  removeSecret(key: string): Promise<void>
}

export interface CreateLLMProfileInput {
  name: string
  baseUrl: string
  modelId: string
  protocol?: LLMProtocol
  timeoutMs?: number
  outputMode?: LLMOutputMode
  language?: string
  maxInputSongs?: number
  apiKey?: string
}

export type UpdateLLMProfileInput = Partial<Omit<CreateLLMProfileInput, 'apiKey'>>

export interface RuntimeLLMProfile {
  profile: LLMProfileRecord
  apiKey: string
}

export type LLMProfileServiceErrorCode = 'PROFILE_NOT_FOUND' | 'API_KEY_MISSING' | 'INVALID_PROFILE'

export class LLMProfileServiceError extends Error {
  constructor(
    readonly code: LLMProfileServiceErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'LLMProfileServiceError'
  }
}

export class LLMProfileService {
  constructor(
    private readonly repository = new LLMProfileRepository(),
    private readonly secretStorage: SecretStorage = new SecureStorageService(),
    private readonly createId: () => string = nanoid,
    private readonly clock: () => string = nowIso
  ) {}

  async create(input: CreateLLMProfileInput): Promise<PublicLLMProfile> {
    const id = this.createId()
    const timestamp = this.clock()
    const secretRef = `llm-profile:${id}:api-key`
    const normalized = normalizeProfileInput(input)
    const profile: LLMProfileRecord = {
      id,
      ...normalized,
      secretRef,
      isActive: this.repository.count() === 0,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    const apiKey = normalizeOptionalApiKey(input.apiKey)
    if (apiKey) {
      await this.secretStorage.setSecret(secretRef, apiKey)
    }

    try {
      this.repository.create(profile)
    } catch (error) {
      if (apiKey) {
        await this.secretStorage.removeSecret(secretRef)
      }
      throw error
    }

    return toPublicProfile(profile, Boolean(apiKey))
  }

  async update(id: string, input: UpdateLLMProfileInput): Promise<PublicLLMProfile> {
    const current = this.requireProfile(id)
    const normalized = normalizeProfileInput({
      name: input.name ?? current.name,
      baseUrl: input.baseUrl ?? current.baseUrl,
      modelId: input.modelId ?? current.modelId,
      protocol: input.protocol ?? current.protocol,
      timeoutMs: input.timeoutMs ?? current.timeoutMs,
      outputMode: input.outputMode ?? current.outputMode,
      language: input.language ?? current.language,
      maxInputSongs: input.maxInputSongs ?? current.maxInputSongs
    })
    const profile: LLMProfileRecord = {
      ...current,
      ...normalized,
      updatedAt: this.clock()
    }

    if (!this.repository.update(profile)) {
      throw new LLMProfileServiceError('PROFILE_NOT_FOUND', '模型配置不存在')
    }
    return toPublicProfile(profile, Boolean(await this.secretStorage.getSecret(profile.secretRef)))
  }

  async list(): Promise<PublicLLMProfile[]> {
    return Promise.all(this.repository.findAll().map((profile) => this.toPublic(profile)))
  }

  async get(id: string): Promise<PublicLLMProfile> {
    return this.toPublic(this.requireProfile(id))
  }

  async getActive(): Promise<PublicLLMProfile | null> {
    const profile = this.repository.findActive()
    return profile ? this.toPublic(profile) : null
  }

  async setActive(id: string): Promise<PublicLLMProfile> {
    if (!this.repository.setActive(id, this.clock())) {
      throw new LLMProfileServiceError('PROFILE_NOT_FOUND', '模型配置不存在')
    }
    return this.get(id)
  }

  async setApiKey(id: string, rawApiKey: string): Promise<void> {
    const profile = this.requireProfile(id)
    const apiKey = normalizeRequiredApiKey(rawApiKey)
    await this.secretStorage.setSecret(profile.secretRef, apiKey)
  }

  async deleteApiKey(id: string): Promise<void> {
    const profile = this.requireProfile(id)
    await this.secretStorage.removeSecret(profile.secretRef)
  }

  async delete(id: string): Promise<boolean> {
    const profile = this.repository.findById(id)
    if (!profile) {
      return false
    }

    // Remove the credential first: a database failure may leave a disabled
    // profile, but must never leave an unowned credential behind.
    await this.secretStorage.removeSecret(profile.secretRef)
    return this.repository.deleteById(id, this.clock())
  }

  async getRuntimeProfile(id: string): Promise<RuntimeLLMProfile> {
    const profile = this.requireProfile(id)
    const apiKey = await this.secretStorage.getSecret(profile.secretRef)
    if (!apiKey) {
      throw new LLMProfileServiceError('API_KEY_MISSING', '该模型配置尚未保存 API Key')
    }
    return { profile, apiKey }
  }

  private requireProfile(id: string): LLMProfileRecord {
    const profile = this.repository.findById(id)
    if (!profile) {
      throw new LLMProfileServiceError('PROFILE_NOT_FOUND', '模型配置不存在')
    }
    return profile
  }

  private async toPublic(profile: LLMProfileRecord): Promise<PublicLLMProfile> {
    return toPublicProfile(profile, Boolean(await this.secretStorage.getSecret(profile.secretRef)))
  }
}

function normalizeProfileInput(
  input: CreateLLMProfileInput
): Omit<
  LLMProfileRecord,
  'id' | 'secretRef' | 'isActive' | 'lastTestedAt' | 'lastTestStatus' | 'createdAt' | 'updatedAt'
> {
  const name = requiredText(input.name, '配置名称', 80)
  const modelId = requiredText(input.modelId, '模型 ID', 200)
  const language = requiredText(input.language ?? 'zh-CN', '报告语言', 32)
  const protocol = input.protocol ?? 'openai_chat_completions'
  const outputMode = input.outputMode ?? 'json_object'
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxInputSongs = input.maxInputSongs ?? DEFAULT_MAX_INPUT_SONGS

  if (!LLM_PROTOCOLS.includes(protocol)) {
    throw invalidProfile('不支持的模型接口协议')
  }
  if (!LLM_OUTPUT_MODES.includes(outputMode)) {
    throw invalidProfile('不支持的模型输出模式')
  }
  if (!isLLMOutputModeSupported(protocol, outputMode)) {
    throw invalidProfile('当前模型接口协议尚不支持所选输出模式')
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 900_000) {
    throw invalidProfile('请求超时必须为 1000 至 900000 毫秒之间的整数')
  }
  if (!Number.isInteger(maxInputSongs) || maxInputSongs < 1 || maxInputSongs > 100) {
    throw invalidProfile('最多分析歌曲数必须为 1 至 100 之间的整数')
  }

  return {
    name,
    protocol,
    baseUrl: normalizeExternalBaseUrl(input.baseUrl).href,
    modelId,
    timeoutMs,
    outputMode,
    language,
    maxInputSongs
  }
}

function requiredText(value: string, label: string, maxLength: number): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) {
    throw invalidProfile(`${label}长度必须为 1 至 ${maxLength} 个字符`)
  }
  return normalized
}

function normalizeOptionalApiKey(value: string | undefined): string | undefined {
  return value === undefined ? undefined : normalizeRequiredApiKey(value)
}

function normalizeRequiredApiKey(value: string): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > 10_000) {
    throw invalidProfile('API Key 不能为空且长度不能超过 10000 个字符')
  }
  return normalized
}

function invalidProfile(message: string): LLMProfileServiceError {
  return new LLMProfileServiceError('INVALID_PROFILE', message)
}

function toPublicProfile(profile: LLMProfileRecord, hasApiKey: boolean): PublicLLMProfile {
  return {
    id: profile.id,
    name: profile.name,
    protocol: profile.protocol,
    baseUrl: profile.baseUrl,
    modelId: profile.modelId,
    timeoutMs: profile.timeoutMs,
    outputMode: profile.outputMode,
    language: profile.language,
    maxInputSongs: profile.maxInputSongs,
    isActive: profile.isActive,
    lastTestedAt: profile.lastTestedAt,
    lastTestStatus: profile.lastTestStatus,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    hasApiKey
  }
}
