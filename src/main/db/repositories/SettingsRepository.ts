import type { Database } from 'better-sqlite3'
import { nanoid } from 'nanoid'
import { getDatabase } from '../database'
import { nowIso } from '../../utils/time'

export class SettingsRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
      | { value: string | null }
      | undefined

    return row?.value ?? null
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO app_settings (id, key, value, updated_at)
         VALUES (@id, @key, @value, @updatedAt)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`
      )
      .run({
        id: nanoid(),
        key,
        value,
        updatedAt: nowIso()
      })
  }

  remove(key: string): void {
    this.db.prepare('DELETE FROM app_settings WHERE key = ?').run(key)
  }

  getAll(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM app_settings').all() as Array<{
      key: string
      value: string | null
    }>

    return rows.reduce<Record<string, string>>((settings, row) => {
      settings[row.key] = row.value ?? ''
      return settings
    }, {})
  }
}
