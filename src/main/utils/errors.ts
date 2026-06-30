import type { IpcResult } from '../types/common'

export function notImplemented(): IpcResult {
  return {
    success: false,
    message: 'Not implemented yet'
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
