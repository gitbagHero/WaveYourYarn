import { describe, expect, it } from 'vitest'
import {
  DEVELOPMENT_LLM_PROTOCOL,
  DevelopmentLLMConfigError,
  readDevelopmentLLMConfig
} from './developmentLlmConfig'

const completeEnvironment = {
  WYY_DEV_LLM_BASE_URL: 'https://llm.example.test/nested/v1',
  WYY_DEV_LLM_MODEL_ID: 'test-model',
  WYY_DEV_LLM_API_KEY: 'test-secret',
  WYY_DEV_LLM_TIMEOUT_MS: '45000'
}

describe('readDevelopmentLLMConfig', () => {
  it('builds an OpenAI-compatible Chat Completions endpoint', () => {
    const config = readDevelopmentLLMConfig({
      isPackaged: false,
      env: completeEnvironment
    })

    expect(config.protocol).toBe(DEVELOPMENT_LLM_PROTOCOL)
    expect(config.baseUrl.href).toBe('https://llm.example.test/nested/v1/')
    expect(config.chatCompletionsUrl.href).toBe(
      'https://llm.example.test/nested/v1/chat/completions'
    )
    expect(config.modelId).toBe('test-model')
    expect(config.apiKey).toBe('test-secret')
    expect(config.timeoutMs).toBe(45_000)
  })

  it('is unavailable in packaged applications even when variables exist', () => {
    expect(() =>
      readDevelopmentLLMConfig({
        isPackaged: true,
        env: completeEnvironment
      })
    ).toThrowError(
      expect.objectContaining<Partial<DevelopmentLLMConfigError>>({
        code: 'DISABLED_IN_PACKAGED_APP'
      })
    )
  })

  it('reports missing variables by name without echoing another secret', () => {
    expect(() =>
      readDevelopmentLLMConfig({
        isPackaged: false,
        env: {
          WYY_DEV_LLM_BASE_URL: completeEnvironment.WYY_DEV_LLM_BASE_URL,
          WYY_DEV_LLM_MODEL_ID: completeEnvironment.WYY_DEV_LLM_MODEL_ID,
          WYY_DEV_LLM_API_KEY: '  '
        }
      })
    ).toThrowError('Missing required environment variable: WYY_DEV_LLM_API_KEY')
  })

  it('rejects non-http Base URLs', () => {
    expect(() =>
      readDevelopmentLLMConfig({
        isPackaged: false,
        env: {
          ...completeEnvironment,
          WYY_DEV_LLM_BASE_URL: 'file:///tmp/provider'
        }
      })
    ).toThrowError(
      expect.objectContaining<Partial<DevelopmentLLMConfigError>>({ code: 'INVALID_BASE_URL' })
    )
  })

  it('uses a bounded default timeout and rejects unsafe values', () => {
    const config = readDevelopmentLLMConfig({
      isPackaged: false,
      env: {
        ...completeEnvironment,
        WYY_DEV_LLM_TIMEOUT_MS: ''
      }
    })
    expect(config.timeoutMs).toBe(60_000)

    const longRunningConfig = readDevelopmentLLMConfig({
      isPackaged: false,
      env: {
        ...completeEnvironment,
        WYY_DEV_LLM_TIMEOUT_MS: '600000'
      }
    })
    expect(longRunningConfig.timeoutMs).toBe(600_000)

    expect(() =>
      readDevelopmentLLMConfig({
        isPackaged: false,
        env: {
          ...completeEnvironment,
          WYY_DEV_LLM_TIMEOUT_MS: '900001'
        }
      })
    ).toThrowError(
      expect.objectContaining<Partial<DevelopmentLLMConfigError>>({ code: 'INVALID_TIMEOUT' })
    )
  })
})
