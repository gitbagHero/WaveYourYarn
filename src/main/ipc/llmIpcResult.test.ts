import { describe, expect, it } from 'vitest'
import { LLMProviderError } from '../adapters/llm/LLMProvider'
import { JobExecutionError } from '../services/JobManager'
import { LLMProfileServiceError } from '../services/LLMProfileService'
import { SecureStorageError } from '../services/SecureStorageService'
import { toLLMIpcResult } from './llmIpcResult'

describe('LLM IPC result boundary', () => {
  it.each([
    [new LLMProfileServiceError('PROFILE_NOT_FOUND', '模型配置不存在'), 'LLM_PROFILE_NOT_FOUND'],
    [new LLMProfileServiceError('API_KEY_MISSING', '尚未保存 Key'), 'LLM_API_KEY_MISSING'],
    [new SecureStorageError(), 'LLM_SECRET_UNAVAILABLE'],
    [new LLMProviderError('LLM_RATE_LIMITED', '模型服务当前限流。'), 'LLM_RATE_LIMITED'],
    [new JobExecutionError('LLM_CANCELLED', '任务已取消'), 'LLM_CANCELLED']
  ] as const)('maps a known error to stable code %s', async (failure, code) => {
    await expect(
      toLLMIpcResult(() => {
        throw failure
      })
    ).resolves.toMatchObject({ success: false, error: code })
  })

  it('never exposes an unknown raw error to the renderer', async () => {
    const result = await toLLMIpcResult(() => {
      throw new Error('database failed with api_key=sk-private-value')
    })

    expect(result).toEqual({
      success: false,
      message: 'LLM 操作失败，请稍后重试',
      error: 'LLM_INTERNAL_ERROR'
    })
    expect(JSON.stringify(result)).not.toContain('sk-private-value')
  })
})
