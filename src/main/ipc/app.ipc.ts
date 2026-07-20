import { app } from 'electron'
import type { IpcResult } from '../types/common'
import { registerIpcHandler } from './registerIpcHandler'

export function registerAppIpc(): void {
  registerIpcHandler('app:get-version', (): IpcResult<string> => ({
    success: true,
    data: app.getVersion()
  }))

  registerIpcHandler('app:ping', (): IpcResult<string> => ({
    success: true,
    data: 'pong'
  }))
}
