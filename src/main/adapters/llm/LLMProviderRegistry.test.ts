import { describe, expect, it, vi } from 'vitest'
import type { LLMProvider } from './LLMProvider'
import { LLMProviderRegistry } from './LLMProviderRegistry'

describe('LLMProviderRegistry', () => {
  it('creates an adapter only from its registered protocol factory', async () => {
    const createCompletion = vi.fn(async () => 'ok')
    const provider: LLMProvider = { createChatCompletion: createCompletion }
    const factory = vi.fn(() => provider)
    const registry = new LLMProviderRegistry()
    registry.register('openai_chat_completions', factory)

    const created = registry.create('openai_chat_completions', {
      baseUrl: 'https://llm.example.test/v1/',
      modelId: 'model-a',
      apiKey: 'fake-key',
      timeoutMs: 10_000
    })

    await expect(created.createChatCompletion({ messages: [] })).resolves.toBe('ok')
    expect(factory).toHaveBeenCalledWith({
      baseUrl: 'https://llm.example.test/v1/',
      modelId: 'model-a',
      apiKey: 'fake-key',
      timeoutMs: 10_000
    })
  })

  it('rejects duplicate protocol registration', () => {
    const registry = new LLMProviderRegistry()
    const factory = (): LLMProvider => ({ createChatCompletion: async () => 'ok' })
    registry.register('openai_chat_completions', factory)
    expect(() => registry.register('openai_chat_completions', factory)).toThrow(
      'already registered'
    )
  })
})
