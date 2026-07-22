export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMChatCompletionRequest {
  messages: LLMChatMessage[]
  maxTokens?: number
  reasoningEffort?: 'low' | 'high' | 'max'
  responseFormat?: 'text' | 'json_object'
  signal?: AbortSignal
}

export interface LLMProvider {
  createChatCompletion(request: LLMChatCompletionRequest): Promise<string>
}

export type LLMProviderErrorCode =
  | 'LLM_AUTH_FAILED'
  | 'LLM_RATE_LIMITED'
  | 'LLM_MODEL_NOT_FOUND'
  | 'LLM_TIMEOUT'
  | 'LLM_CANCELLED'
  | 'LLM_NETWORK_ERROR'
  | 'LLM_ENDPOINT_BLOCKED'
  | 'LLM_OUTPUT_INVALID'
  | 'LLM_PROVIDER_ERROR'

export class LLMProviderError extends Error {
  constructor(
    readonly code: LLMProviderErrorCode,
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'LLMProviderError'
  }
}
