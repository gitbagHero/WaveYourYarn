import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import {
  LLMProviderError,
  OpenAICompatibleProvider
} from '../src/main/adapters/llm/OpenAICompatibleProvider'
import {
  DevelopmentLLMConfigError,
  readDevelopmentLLMConfig
} from '../src/main/config/developmentLlmConfig'

const projectRoot = resolve(import.meta.dirname, '..')
const loadedEnvironment = loadEnv('development', projectRoot, 'WYY_DEV_LLM_')
const environment = { ...loadedEnvironment, ...process.env }

try {
  const config = readDevelopmentLLMConfig({ isPackaged: false, env: environment })
  const provider = new OpenAICompatibleProvider({
    ...config,
    // Keep the fixed ping bounded even when report generation is allowed to run longer.
    timeoutMs: Math.min(config.timeoutMs, 60_000)
  })
  const content = await provider.createChatCompletion({
    messages: [
      {
        role: 'system',
        content: 'This is a connection test. Do not use tools. Reply with exactly OK.'
      },
      { role: 'user', content: 'ping' }
    ],
    maxTokens: 256,
    reasoningEffort: 'low'
  })

  console.info('Development LLM connection test succeeded.', {
    receivedNonEmptyResponse: content.trim().length > 0
  })
} catch (error) {
  if (error instanceof LLMProviderError || error instanceof DevelopmentLLMConfigError) {
    console.error('Development LLM connection test failed.', {
      code: error.code,
      message: error.message,
      ...('status' in error && error.status ? { status: error.status } : {})
    })
  } else {
    console.error('Development LLM connection test failed.', {
      code: 'DEV_LLM_CONNECTION_FAILED',
      message: error instanceof Error ? error.message : 'Unknown development error.'
    })
  }
  process.exitCode = 1
}
