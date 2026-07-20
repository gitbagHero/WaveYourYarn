import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import type { IpcResult } from '../types/common'
import { logger } from '../utils/logger'
import { isTrustedIpcSender, sanitizeUrlForLog } from '../security/urlPolicy'

type IpcHandler<Args extends unknown[], Result> = (
  event: IpcMainInvokeEvent,
  ...args: Args
) => Result | Promise<Result>

const rendererFilePath = join(__dirname, '../renderer/index.html')

export function registerIpcHandler<Args extends unknown[], Result>(
  channel: string,
  handler: IpcHandler<Args, Result>
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    const senderFrame = event.senderFrame
    const senderUrl = senderFrame?.url ?? event.sender.getURL()
    const trusted = isTrustedIpcSender(senderUrl, senderFrame === event.sender.mainFrame, {
      devServerUrl: process.env.ELECTRON_RENDERER_URL,
      rendererFilePath
    })

    if (!trusted) {
      logger.warn('已拒绝非可信 IPC 调用', {
        channel,
        sender: sanitizeUrlForLog(senderUrl)
      })

      return {
        success: false,
        message: 'IPC 调用来源不受信任',
        error: 'UNTRUSTED_IPC_SENDER'
      } satisfies IpcResult
    }

    return handler(event, ...(args as Args))
  })
}
