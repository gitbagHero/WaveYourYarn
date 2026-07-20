import type { IpcResult } from '../types/common'
import { toErrorMessage } from '../utils/errors'

interface IpcResultOptions {
  codeByMessage?: Record<string, string>
}

export async function toIpcResult<T>(
  operation: () => T | Promise<T>,
  fallbackMessage: string,
  options: IpcResultOptions = {}
): Promise<IpcResult<T>> {
  try {
    return {
      success: true,
      data: await operation()
    }
  } catch (error) {
    const errorMessage = toErrorMessage(error)
    const errorCode = options.codeByMessage?.[errorMessage]

    return {
      success: false,
      message: errorCode ? errorMessage : fallbackMessage,
      error: errorCode ?? errorMessage
    }
  }
}

export function ipcFailure<T>(message: string, error: unknown): IpcResult<T> {
  return {
    success: false,
    message,
    error: toErrorMessage(error)
  }
}
