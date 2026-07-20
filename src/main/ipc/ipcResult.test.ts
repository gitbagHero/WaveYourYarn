import { describe, expect, it } from 'vitest'
import { ipcFailure, toIpcResult } from './ipcResult'

describe('IPC result helpers', () => {
  it('normalizes successful and failed operations', async () => {
    await expect(toIpcResult(() => 42, '失败')).resolves.toEqual({ success: true, data: 42 })
    await expect(
      toIpcResult(
        () => {
          throw new Error('not logged in')
        },
        '同步失败',
        { codeByMessage: { 'not logged in': 'NOT_LOGGED_IN' } }
      )
    ).resolves.toEqual({
      success: false,
      message: 'not logged in',
      error: 'NOT_LOGGED_IN'
    })
  })

  it('redacts sensitive error values before crossing IPC', () => {
    const result = ipcFailure('请求失败', new Error('Bearer private-token'))

    expect(result.error).not.toContain('private-token')
    expect(result.error).toContain('[REDACTED]')
  })
})
