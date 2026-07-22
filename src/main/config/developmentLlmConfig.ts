export const DEVELOPMENT_LLM_PROTOCOL = 'openai_chat_completions' as const

export const DEVELOPMENT_LLM_ENV_KEYS = {
  baseUrl: 'WYY_DEV_LLM_BASE_URL',
  modelId: 'WYY_DEV_LLM_MODEL_ID',
  apiKey: 'WYY_DEV_LLM_API_KEY',
  timeoutMs: 'WYY_DEV_LLM_TIMEOUT_MS'
} as const

const DEFAULT_TIMEOUT_MS = 60_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 900_000

export interface DevelopmentLLMConfig {
  readonly protocol: typeof DEVELOPMENT_LLM_PROTOCOL
  readonly baseUrl: URL
  readonly chatCompletionsUrl: URL
  readonly modelId: string
  readonly apiKey: string
  readonly timeoutMs: number
}

export type DevelopmentLLMConfigErrorCode =
  'DISABLED_IN_PACKAGED_APP' | 'MISSING_ENV' | 'INVALID_BASE_URL' | 'INVALID_TIMEOUT'

export class DevelopmentLLMConfigError extends Error {
  constructor(
    readonly code: DevelopmentLLMConfigErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'DevelopmentLLMConfigError'
  }
}

interface ReadDevelopmentLLMConfigOptions {
  /** Must come from Electron's app.isPackaged at the call site. */
  isPackaged: boolean
  env?: NodeJS.ProcessEnv
}

/**
 * Reads the development-only OpenAI-compatible profile.
 *
 * This function belongs to the main process. Never expose its result through
 * preload/IPC, persist it, or log it because the object contains the API key.
 */
export function readDevelopmentLLMConfig(
  options: ReadDevelopmentLLMConfigOptions
): DevelopmentLLMConfig {
  if (options.isPackaged) {
    throw new DevelopmentLLMConfigError(
      'DISABLED_IN_PACKAGED_APP',
      'Development LLM configuration is disabled in packaged applications.'
    )
  }

  const env = options.env ?? process.env
  const baseUrlValue = requireEnvironmentValue(env, DEVELOPMENT_LLM_ENV_KEYS.baseUrl)
  const modelId = requireEnvironmentValue(env, DEVELOPMENT_LLM_ENV_KEYS.modelId)
  const apiKey = requireEnvironmentValue(env, DEVELOPMENT_LLM_ENV_KEYS.apiKey)
  const timeoutMs = parseTimeout(env[DEVELOPMENT_LLM_ENV_KEYS.timeoutMs])
  const baseUrl = parseBaseUrl(baseUrlValue)

  return {
    protocol: DEVELOPMENT_LLM_PROTOCOL,
    baseUrl,
    chatCompletionsUrl: new URL('chat/completions', ensureTrailingSlash(baseUrl)),
    modelId,
    apiKey,
    timeoutMs
  }
}

function requireEnvironmentValue(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim()

  if (!value) {
    throw new DevelopmentLLMConfigError(
      'MISSING_ENV',
      `Missing required environment variable: ${key}`
    )
  }

  return value
}

function parseBaseUrl(value: string): URL {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new DevelopmentLLMConfigError('INVALID_BASE_URL', 'Development LLM Base URL is invalid.')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new DevelopmentLLMConfigError(
      'INVALID_BASE_URL',
      'Development LLM Base URL must use HTTP or HTTPS.'
    )
  }

  url.hash = ''
  url.search = ''
  return new URL(ensureTrailingSlash(url))
}

function ensureTrailingSlash(url: URL): string {
  return url.href.endsWith('/') ? url.href : `${url.href}/`
}

function parseTimeout(rawValue: string | undefined): number {
  if (rawValue === undefined || rawValue.trim() === '') {
    return DEFAULT_TIMEOUT_MS
  }

  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < MIN_TIMEOUT_MS || value > MAX_TIMEOUT_MS) {
    throw new DevelopmentLLMConfigError(
      'INVALID_TIMEOUT',
      `Development LLM timeout must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} milliseconds.`
    )
  }

  return value
}
