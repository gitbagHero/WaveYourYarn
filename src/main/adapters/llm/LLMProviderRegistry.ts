import type { RuntimeLLMProfile } from '../../services/LLMProfileService'
import type { LLMProtocol } from '../../types/llm'
import { normalizeExternalBaseUrl } from '../../security/externalUrlPolicy'
import type { LLMProvider } from './LLMProvider'
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider'

export interface LLMProviderRuntimeConfig {
  baseUrl: string
  modelId: string
  apiKey: string
  timeoutMs: number
}

export type LLMProviderFactory = (config: LLMProviderRuntimeConfig) => LLMProvider

export class LLMProviderRegistry {
  private readonly factories = new Map<LLMProtocol, LLMProviderFactory>()

  register(protocol: LLMProtocol, factory: LLMProviderFactory): void {
    if (this.factories.has(protocol)) {
      throw new Error(`LLM protocol is already registered: ${protocol}`)
    }
    this.factories.set(protocol, factory)
  }

  create(protocol: LLMProtocol, config: LLMProviderRuntimeConfig): LLMProvider {
    const factory = this.factories.get(protocol)
    if (!factory) {
      throw new Error(`LLM protocol is not registered: ${protocol}`)
    }
    return factory(config)
  }

  createFromRuntimeProfile(runtime: RuntimeLLMProfile): LLMProvider {
    return this.create(runtime.profile.protocol, {
      baseUrl: runtime.profile.baseUrl,
      modelId: runtime.profile.modelId,
      apiKey: runtime.apiKey,
      timeoutMs: runtime.profile.timeoutMs
    })
  }
}

export function createDefaultLLMProviderRegistry(): LLMProviderRegistry {
  const registry = new LLMProviderRegistry()
  registry.register('openai_chat_completions', (config) => {
    const baseUrl = new URL(normalizeExternalBaseUrl(config.baseUrl).href)
    return new OpenAICompatibleProvider({
      chatCompletionsUrl: new URL('chat/completions', baseUrl),
      modelId: config.modelId,
      apiKey: config.apiKey,
      timeoutMs: config.timeoutMs
    })
  })
  return registry
}
