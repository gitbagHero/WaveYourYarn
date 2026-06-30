import type { Database } from 'better-sqlite3'
import { getDatabase } from '../database'

export class ExportRecordRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM export_records').get() as {
      count: number
    }
    return row.count
  }
}
