import type { IpcResult } from '../types/common'
import { redactText } from './redaction'

export function notImplemented(): IpcResult {
  return {
    success: false,
    message: 'Not implemented yet'
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return redactText(error.message)
  }

  return redactText(String(error))
}
