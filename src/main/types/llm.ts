export const LLM_PROTOCOLS = ['openai_chat_completions'] as const
export type LLMProtocol = (typeof LLM_PROTOCOLS)[number]

export const LLM_OUTPUT_MODES = ['json_schema', 'json_object', 'prompt_json'] as const
export type LLMOutputMode = (typeof LLM_OUTPUT_MODES)[number]

export interface LLMProtocolCapabilities {
  outputModes: readonly LLMOutputMode[]
}

export const LLM_PROTOCOL_CAPABILITIES: Record<LLMProtocol, LLMProtocolCapabilities> = {
  openai_chat_completions: {
    // json_schema requires a separate request contract and is not silently
    // treated as json_object by the current adapter.
    outputModes: ['json_object', 'prompt_json']
  }
}

export function isLLMOutputModeSupported(
  protocol: LLMProtocol,
  outputMode: LLMOutputMode
): boolean {
  return LLM_PROTOCOL_CAPABILITIES[protocol].outputModes.includes(outputMode)
}

export const LLM_CONNECTION_TEST_STATUSES = ['succeeded', 'failed'] as const
export type LLMConnectionTestStatus = (typeof LLM_CONNECTION_TEST_STATUSES)[number]

export interface LLMProfileRecord {
  id: string
  name: string
  protocol: LLMProtocol
  baseUrl: string
  modelId: string
  timeoutMs: number
  outputMode: LLMOutputMode
  language: string
  maxInputSongs: number
  secretRef: string
  isActive: boolean
  lastTestedAt?: string
  lastTestStatus?: LLMConnectionTestStatus
  createdAt: string
  updatedAt: string
}

/** Renderer-safe profile shape. API keys and secret references are never exposed. */
export type PublicLLMProfile = Omit<LLMProfileRecord, 'secretRef'> & {
  hasApiKey: boolean
}

export interface LLMProtocolOption {
  protocol: LLMProtocol
  label: string
  outputModes: readonly LLMOutputMode[]
}

export interface CreateLLMProfileRequest {
  name: string
  protocol: LLMProtocol
  baseUrl: string
  modelId: string
  timeoutMs: number
  outputMode: LLMOutputMode
  language: string
  maxInputSongs: number
}

export interface UpdateLLMProfileRequest {
  id: string
  changes: Partial<CreateLLMProfileRequest>
}

export interface LLMProfileIdRequest {
  id: string
}

export interface LLMJobIdRequest {
  id: string
}

export interface SetLLMProfileApiKeyRequest extends LLMProfileIdRequest {
  apiKey: string
}

export const JOB_RUN_KINDS = ['llm_connection_test', 'ai_report_generation'] as const
export type JobRunKind = (typeof JOB_RUN_KINDS)[number]

export const JOB_RUN_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'interrupted'
] as const
export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number]

export interface JobRun {
  id: string
  kind: JobRunKind
  profileId?: string
  status: JobRunStatus
  stage: string
  progressCurrent?: number
  progressTotal?: number
  inputSummary: Record<string, unknown>
  errorCode?: string
  safeMessage?: string
  retryOfJobId?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
}

export const AI_DISCLOSURE_SOURCE_TYPES = ['liked', 'playlist', 'all'] as const
export type AIDisclosureSourceType = (typeof AI_DISCLOSURE_SOURCE_TYPES)[number]

export interface AIDisclosureConsent {
  id: string
  profileId: string
  targetOrigin: string
  protocol: LLMProtocol
  sourceType: AIDisclosureSourceType
  sourceId?: string
  fieldsHash: string
  maxInputSongs: number
  createdAt: string
  updatedAt: string
}

export interface AIDisclosureField {
  path: string
  label: string
}

export interface AIDisclosureSourceRequest {
  type: AIDisclosureSourceType
  playlistId?: string
}

export interface AIDisclosurePreviewRequest {
  profileId: string
  source: AIDisclosureSourceRequest
}

export interface AIDisclosurePreview {
  previewId: string
  expiresAt: string
  profile: {
    id: string
    name: string
    modelId: string
  }
  targetOrigin: string
  protocol: LLMProtocol
  source: {
    type: AIDisclosureSourceType
    id?: string
    name: string
  }
  songCount: number
  maximumSongCount: number
  fields: AIDisclosureField[]
  fieldsHash: string
  datasetDigest: string
  includesNickname: false
  requiresConfirmation: boolean
  matchedRememberedConsent: boolean
  notices: string[]
}

export interface AuthorizeAIDisclosureRequest {
  previewId: string
  confirmed: boolean
  remember: boolean
}

export interface AIDisclosureAuthorization {
  token: string
  expiresAt: string
  remembered: boolean
}

export interface AIDisclosurePreferences {
  confirmationMode: 'always' | 'allow_remembered'
  rememberedConsentCount: number
}

export interface SetAIDisclosurePreferencesRequest {
  confirmationMode: AIDisclosurePreferences['confirmationMode']
}
