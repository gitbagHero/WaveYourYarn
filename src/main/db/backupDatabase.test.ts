import { describe, expect, it } from 'vitest'
import { assertSupportedBackupSchema } from './backupDatabase'

describe('backup database compatibility', () => {
  it('accepts current and older schemas', () => {
    expect(() => assertSupportedBackupSchema(7, 7)).not.toThrow()
    expect(() => assertSupportedBackupSchema(6, 7)).not.toThrow()
  })

  it('rejects databases created by a newer application schema', () => {
    expect(() => assertSupportedBackupSchema(8, 7)).toThrow('备份数据库版本 8 高于当前支持版本 7')
  })
})
