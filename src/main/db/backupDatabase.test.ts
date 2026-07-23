import { describe, expect, it } from 'vitest'
import { assertSupportedBackupSchema } from './backupDatabase'

describe('backup database compatibility', () => {
  it('accepts current and older schemas', () => {
    expect(() => assertSupportedBackupSchema(8, 8)).not.toThrow()
    expect(() => assertSupportedBackupSchema(7, 8)).not.toThrow()
  })

  it('rejects databases created by a newer application schema', () => {
    expect(() => assertSupportedBackupSchema(9, 8)).toThrow('备份数据库版本 9 高于当前支持版本 8')
  })
})
