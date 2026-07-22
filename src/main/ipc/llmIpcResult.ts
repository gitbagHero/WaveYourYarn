import type { IpcResult } from '../types/common'
import { LLMProviderError } from '../adapters/llm/LLMProvider'
import { ExternalUrlPolicyError } from '../security/externalUrlPolicy'
import { JobExecutionError } from '../services/JobManager'
import { LLMProfileServiceError } from '../services/LLMProfileService'
import { SecureStorageError } from '../services/SecureStorageService'
import { logger } from '../utils/logger'
import { LLMIpcValidationError } from './llmValidators'

export async function toLLMIpcResult<Result>(
  operation: () => Result | Promise<Result>
): Promise<IpcResult<Result>> {
  try {
    return { success: true, data: await operation() }
  } catch (error) {
    const failure = toSafeLLMFailure(error)
    if (failure.error === 'LLM_INTERNAL_ERROR') {
      logger.error('LLM IPC operation failed', error)
    }
    return { success: false, ...failure }
  }
}

function toSafeLLMFailure(error: unknown): { message: string; error: string } {
  if (error instanceof LLMProfileServiceError) {
    const codes = {
      PROFILE_NOT_FOUND: 'LLM_PROFILE_NOT_FOUND',
      API_KEY_MISSING: 'LLM_API_KEY_MISSING',
      INVALID_PROFILE: 'LLM_PROFILE_INVALID'
    } as const
    return { message: error.message, error: codes[error.code] }
  }
  if (error instanceof LLMIpcValidationError) {
    return { message: error.message, error: error.code }
  }
  if (error instanceof ExternalUrlPolicyError) {
    return { message: error.message, error: 'LLM_PROFILE_INVALID' }
  }
  if (error instanceof SecureStorageError) {
    return { message: error.message, error: 'LLM_SECRET_UNAVAILABLE' }
  }
  if (error instanceof LLMProviderError) {
    return { message: error.message, error: error.code }
  }
  if (error instanceof JobExecutionError) {
    return { message: error.safeMessage, error: normalizeJobErrorCode(error.code) }
  }
  return { message: 'LLM 操作失败，请稍后重试', error: 'LLM_INTERNAL_ERROR' }
}

function normalizeJobErrorCode(code: string): string {
  return /^[A-Z][A-Z0-9_]{1,63}$/.test(code) ? code : 'JOB_FAILED'
}
