import type Database from 'better-sqlite3'
import { createRequire } from 'node:module'
import { runDatabaseMigrations } from '../migrationRunner'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')

export function createTestDatabase(): Database.Database {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')

  Object.defineProperty(sqlite, 'transaction', {
    value: <Result>(operation: () => Result) => {
      return () => {
        sqlite.exec('BEGIN')

        try {
          const result = operation()
          sqlite.exec('COMMIT')
          return result
        } catch (error) {
          sqlite.exec('ROLLBACK')
          throw error
        }
      }
    }
  })

  const db = sqlite as unknown as Database.Database
  runDatabaseMigrations(db)
  return db
}
