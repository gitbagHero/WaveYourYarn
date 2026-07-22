import {
  NetworkTransport,
  NetworkTransportError,
  type NetworkTransportLike
} from '../../security/NetworkTransport'
import { LLMProviderError, type LLMChatCompletionRequest, type LLMProvider } from './LLMProvider'

export { LLMProviderError } from './LLMProvider'
export type {
  LLMChatCompletionRequest,
  LLMChatMessage,
  LLMProvider,
  LLMProviderErrorCode
} from './LLMProvider'

export interface OpenAICompatibleProviderConfig {
  readonly chatCompletionsUrl: URL
  readonly modelId: string
  readonly apiKey: string
  readonly timeoutMs: number
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
}

const MAX_RESPONSE_CHARACTERS = 1_000_000

export class OpenAICompatibleProvider implements LLMProvider {
  constructor(
    private readonly config: OpenAICompatibleProviderConfig,
    private readonly transport: NetworkTransportLike = new NetworkTransport()
  ) {}

  async createChatCompletion(request: LLMChatCompletionRequest): Promise<string> {
    try {
      const response = await this.transport.request(this.config.chatCompletionsUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'WaveYourYarn/0.3'
        },
        body: JSON.stringify({
          model: this.config.modelId,
          messages: request.messages,
          stream: false,
          ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
          ...(request.reasoningEffort ? { reasoning_effort: request.reasoningEffort } : {}),
          ...(request.responseFormat ? { response_format: { type: request.responseFormat } } : {})
        }),
        timeoutMs: this.config.timeoutMs,
        signal: request.signal
      })

      if (!response.ok) {
        throw mapProviderStatus(response.status)
      }

      const rawResponse = await response.text()
      if (rawResponse.length > MAX_RESPONSE_CHARACTERS) {
        throw new LLMProviderError('LLM_OUTPUT_INVALID', '模型响应超过安全长度限制。')
      }

      let parsed: ChatCompletionResponse
      try {
        parsed = JSON.parse(rawResponse) as ChatCompletionResponse
      } catch {
        throw new LLMProviderError('LLM_OUTPUT_INVALID', '模型返回了无法解析的响应。')
      }

      const content = parsed.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content.trim()) {
        throw new LLMProviderError('LLM_OUTPUT_INVALID', '模型响应缺少文本内容。')
      }

      return content
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error
      }
      if (error instanceof NetworkTransportError) {
        throw mapNetworkError(error)
      }
      throw new LLMProviderError('LLM_NETWORK_ERROR', '无法连接模型服务。')
    }
  }
}

function mapNetworkError(error: NetworkTransportError): LLMProviderError {
  switch (error.code) {
    case 'NETWORK_CANCELLED':
      return new LLMProviderError('LLM_CANCELLED', '模型请求已取消。')
    case 'NETWORK_TIMEOUT':
      return new LLMProviderError('LLM_TIMEOUT', '模型请求超时。')
    case 'ENDPOINT_BLOCKED':
    case 'REDIRECT_BLOCKED':
      return new LLMProviderError('LLM_ENDPOINT_BLOCKED', '模型服务地址被安全策略阻止。')
    default:
      return new LLMProviderError('LLM_NETWORK_ERROR', '无法连接模型服务。')
  }
}

function mapProviderStatus(status: number): LLMProviderError {
  if (status === 401 || status === 403) {
    return new LLMProviderError('LLM_AUTH_FAILED', '模型服务鉴权失败。', status)
  }
  if (status === 404) {
    return new LLMProviderError('LLM_MODEL_NOT_FOUND', '模型或接口不存在。', status)
  }
  if (status === 429) {
    return new LLMProviderError('LLM_RATE_LIMITED', '模型服务当前限流。', status)
  }
  return new LLMProviderError('LLM_PROVIDER_ERROR', '模型服务返回错误。', status)
}
