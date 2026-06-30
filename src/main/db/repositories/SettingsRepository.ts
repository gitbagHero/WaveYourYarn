import type { Database } from 'better-sqlite3'
import { getDatabase } from '../database'

export class SettingsRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
      | { value: string | null }
      | undefined

    return row?.value ?? null
  }
}
