import Database from 'better-sqlite3'
import { getDatabasePath } from '../utils/paths'
import { logger } from '../utils/logger'
import { runDatabaseMigrations } from './migrationRunner'

let database: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!database) {
    database = new Database(getDatabasePath())
  }

  return database
}

export function initializeDatabase(): void {
  const db = getDatabase()
  runDatabaseMigrations(db)
  logger.info('SQLite database initialized')
}

export function closeDatabase(): void {
  if (!database) {
    return
  }

  database.close()
  database = null
  logger.info('SQLite database closed')
}
