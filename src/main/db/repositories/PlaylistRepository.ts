import type { Database } from 'better-sqlite3'
import { getDatabase } from '../database'

export class PlaylistRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM playlists').get() as { count: number }
    return row.count
  }
}
