import {
  LLM_OUTPUT_MODES,
  LLM_PROTOCOLS,
  type CreateLLMProfileRequest,
  type LLMJobIdRequest,
  type LLMProfileIdRequest,
  type SetLLMProfileApiKeyRequest,
  type UpdateLLMProfileRequest
} from '../types/llm'

const PROFILE_FIELD_KEYS = [
  'name',
  'protocol',
  'baseUrl',
  'modelId',
  'timeoutMs',
  'outputMode',
  'language',
  'maxInputSongs'
] as const

export class LLMIpcValidationError extends Error {
  readonly code = 'LLM_PROFILE_INVALID'

  constructor(message = 'LLM 配置参数格式不正确') {
    super(message)
    this.name = 'LLMIpcValidationError'
  }
}

export function parseCreateLLMProfileRequest(value: unknown): CreateLLMProfileRequest {
  const object = readStrictObject(value, PROFILE_FIELD_KEYS)
  return readProfileFields(object, true) as CreateLLMProfileRequest
}

export function parseUpdateLLMProfileRequest(value: unknown): UpdateLLMProfileRequest {
  const object = readStrictObject(value, ['id', 'changes'])
  const changesObject = readStrictObject(object.changes, PROFILE_FIELD_KEYS)
  const changes = readProfileFields(changesObject, false)
  if (Object.keys(changes).length === 0) {
    throw new LLMIpcValidationError('至少需要修改一个 LLM 配置字段')
  }
  return { id: readId(object.id), changes }
}

export function parseLLMProfileIdRequest(value: unknown): LLMProfileIdRequest {
  const object = readStrictObject(value, ['id'])
  return { id: readId(object.id) }
}

export function parseLLMJobIdRequest(value: unknown): LLMJobIdRequest {
  const object = readStrictObject(value, ['id'])
  return { id: readId(object.id) }
}

export function parseSetLLMProfileApiKeyRequest(value: unknown): SetLLMProfileApiKeyRequest {
  const object = readStrictObject(value, ['id', 'apiKey'])
  return {
    id: readId(object.id),
    apiKey: readString(object.apiKey, 'API Key', 10_000)
  }
}

function readProfileFields(
  object: Record<string, unknown>,
  required: boolean
): Partial<CreateLLMProfileRequest> {
  const result: Partial<CreateLLMProfileRequest> = {}
  readOptional(object, 'name', required, (value) => {
    result.name = readString(value, '配置名称', 80)
  })
  readOptional(object, 'protocol', required, (value) => {
    result.protocol = readEnum(value, LLM_PROTOCOLS, '接口协议')
  })
  readOptional(object, 'baseUrl', required, (value) => {
    result.baseUrl = readString(value, 'Base URL', 2_048)
  })
  readOptional(object, 'modelId', required, (value) => {
    result.modelId = readString(value, '模型 ID', 200)
  })
  readOptional(object, 'timeoutMs', required, (value) => {
    result.timeoutMs = readInteger(value, '请求超时')
  })
  readOptional(object, 'outputMode', required, (value) => {
    result.outputMode = readEnum(value, LLM_OUTPUT_MODES, '输出模式')
  })
  readOptional(object, 'language', required, (value) => {
    result.language = readString(value, '报告语言', 32)
  })
  readOptional(object, 'maxInputSongs', required, (value) => {
    result.maxInputSongs = readInteger(value, '最多分析歌曲数')
  })
  return result
}

function readStrictObject<const Key extends string>(
  value: unknown,
  allowedKeys: readonly Key[]
): Record<Key, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LLMIpcValidationError()
  }
  const object = value as Record<string, unknown>
  const allowed = new Set<string>(allowedKeys)
  if (Object.keys(object).some((key) => !allowed.has(key))) {
    throw new LLMIpcValidationError('LLM 请求包含不支持的字段')
  }
  return object as Record<Key, unknown>
}

function readOptional(
  object: Record<string, unknown>,
  key: string,
  required: boolean,
  assign: (value: unknown) => void
): void {
  if (!(key in object)) {
    if (required) {
      throw new LLMIpcValidationError(`缺少必要字段：${key}`)
    }
    return
  }
  assign(object[key])
}

function readString(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== 'string') {
    throw new LLMIpcValidationError(`${label}必须是字符串`)
  }
  const normalized = value.trim()
  if (!normalized || normalized.length > maximumLength) {
    throw new LLMIpcValidationError(`${label}不能为空且不能超过 ${maximumLength} 个字符`)
  }
  return normalized
}

function readId(value: unknown): string {
  return readString(value, '配置 ID', 200)
}

function readInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new LLMIpcValidationError(`${label}必须是整数`)
  }
  return value
}

function readEnum<Value extends string>(
  value: unknown,
  allowedValues: readonly Value[],
  label: string
): Value {
  if (typeof value !== 'string' || !allowedValues.includes(value as Value)) {
    throw new LLMIpcValidationError(`${label}不受支持`)
  }
  return value as Value
}
