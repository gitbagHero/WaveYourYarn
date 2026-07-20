import { describe, expect, it } from 'vitest'
import { RestoreSelectionStore } from './RestoreSelectionStore'

describe('RestoreSelectionStore', () => {
  it('issues a token that can be consumed only once', () => {
    const store = new RestoreSelectionStore(1_000, () => 'token-1')
    const token = store.issue('/tmp/backup.wyybackup', 100)

    expect(token).toBe('token-1')
    expect(store.consume(token, 200)).toBe('/tmp/backup.wyybackup')
    expect(store.consume(token, 300)).toBeNull()
  })

  it('rejects an expired token', () => {
    const store = new RestoreSelectionStore(100, () => 'token-1')
    const token = store.issue('/tmp/backup.wyybackup', 100)

    expect(store.consume(token, 200)).toBeNull()
  })
})
