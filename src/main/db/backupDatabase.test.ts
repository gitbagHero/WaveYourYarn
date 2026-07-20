import { describe, expect, it } from 'vitest'
import { assertSupportedBackupSchema } from './backupDatabase'

describe('backup database compatibility', () => {
  it('accepts current and older schemas', () => {
    expect(() => assertSupportedBackupSchema(6, 6)).not.toThrow()
    expect(() => assertSupportedBackupSchema(5, 6)).not.toThrow()
  })

  it('rejects databases created by a newer application schema', () => {
    expect(() => assertSupportedBackupSchema(7, 6)).toThrow('备份数据库版本 7 高于当前支持版本 6')
  })
})
