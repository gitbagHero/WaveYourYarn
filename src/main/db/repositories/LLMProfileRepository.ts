import type { Database } from 'better-sqlite3'
import { getDatabase } from '../database'
import type {
  LLMConnectionTestStatus,
  LLMOutputMode,
  LLMProfileRecord,
  LLMProtocol
} from '../../types/llm'

export class LLMProfileRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM llm_profiles').get() as {
      count: number
    }
    return row.count
  }

  create(profile: LLMProfileRecord): void {
    this.db
      .prepare(
        `INSERT INTO llm_profiles (
          id, name, protocol, base_url, model_id, timeout_ms, output_mode, language,
          max_input_songs, secret_ref, is_active, last_tested_at, last_test_status,
          created_at, updated_at
        ) VALUES (
          @id, @name, @protocol, @baseUrl, @modelId, @timeoutMs, @outputMode, @language,
          @maxInputSongs, @secretRef, @isActive, @lastTestedAt, @lastTestStatus,
          @createdAt, @updatedAt
        )`
      )
      .run(toParameters(profile))
  }

  update(profile: LLMProfileRecord): boolean {
    const result = this.db
      .prepare(
        `UPDATE llm_profiles SET
          name = @name,
          protocol = @protocol,
          base_url = @baseUrl,
          model_id = @modelId,
          timeout_ms = @timeoutMs,
          output_mode = @outputMode,
          language = @language,
          max_input_songs = @maxInputSongs,
          updated_at = @updatedAt
        WHERE id = @id`
      )
      .run(toUpdateParameters(profile))
    return result.changes === 1
  }

  findAll(): LLMProfileRecord[] {
    return (
      this.db
        .prepare('SELECT * FROM llm_profiles ORDER BY is_active DESC, updated_at DESC, id ASC')
        .all() as LLMProfileRow[]
    ).map(fromRow)
  }

  findById(id: string): LLMProfileRecord | null {
    const row = this.db.prepare('SELECT * FROM llm_profiles WHERE id = ?').get(id) as
      LLMProfileRow | undefined
    return row ? fromRow(row) : null
  }

  findActive(): LLMProfileRecord | null {
    const row = this.db.prepare('SELECT * FROM llm_profiles WHERE is_active = 1').get() as
      LLMProfileRow | undefined
    return row ? fromRow(row) : null
  }

  setActive(id: string, updatedAt: string): boolean {
    return this.db.transaction(() => {
      const exists = this.db.prepare('SELECT 1 FROM llm_profiles WHERE id = ?').get(id)
      if (!exists) {
        return false
      }

      this.db.prepare('UPDATE llm_profiles SET is_active = 0 WHERE is_active = 1').run()
      this.db
        .prepare('UPDATE llm_profiles SET is_active = 1, updated_at = ? WHERE id = ?')
        .run(updatedAt, id)
      return true
    })()
  }

  updateConnectionTest(id: string, status: LLMConnectionTestStatus, testedAt: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE llm_profiles
         SET last_test_status = ?, last_tested_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(status, testedAt, testedAt, id)
    return result.changes === 1
  }

  deleteById(id: string, updatedAt: string): boolean {
    return this.db.transaction(() => {
      const row = this.db.prepare('SELECT is_active FROM llm_profiles WHERE id = ?').get(id) as
        { is_active: number } | undefined
      if (!row) {
        return false
      }

      this.db.prepare('DELETE FROM llm_profiles WHERE id = ?').run(id)
      if (row.is_active === 1) {
        this.db
          .prepare(
            `UPDATE llm_profiles
             SET is_active = 1, updated_at = ?
             WHERE id = (
               SELECT id FROM llm_profiles ORDER BY updated_at DESC, id ASC LIMIT 1
             )`
          )
          .run(updatedAt)
      }
      return true
    })()
  }
}

interface LLMProfileRow {
  id: string
  name: string
  protocol: LLMProtocol
  base_url: string
  model_id: string
  timeout_ms: number
  output_mode: LLMOutputMode
  language: string
  max_input_songs: number
  secret_ref: string
  is_active: number
  last_tested_at: string | null
  last_test_status: LLMConnectionTestStatus | null
  created_at: string
  updated_at: string
}

function fromRow(row: LLMProfileRow): LLMProfileRecord {
  return {
    id: row.id,
    name: row.name,
    protocol: row.protocol,
    baseUrl: row.base_url,
    modelId: row.model_id,
    timeoutMs: row.timeout_ms,
    outputMode: row.output_mode,
    language: row.language,
    maxInputSongs: row.max_input_songs,
    secretRef: row.secret_ref,
    isActive: row.is_active === 1,
    lastTestedAt: row.last_tested_at ?? undefined,
    lastTestStatus: row.last_test_status ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toParameters(profile: LLMProfileRecord): Record<string, string | number | null> {
  return {
    id: profile.id,
    name: profile.name,
    protocol: profile.protocol,
    baseUrl: profile.baseUrl,
    modelId: profile.modelId,
    timeoutMs: profile.timeoutMs,
    outputMode: profile.outputMode,
    language: profile.language,
    maxInputSongs: profile.maxInputSongs,
    secretRef: profile.secretRef,
    isActive: profile.isActive ? 1 : 0,
    lastTestedAt: profile.lastTestedAt ?? null,
    lastTestStatus: profile.lastTestStatus ?? null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  }
}

function toUpdateParameters(profile: LLMProfileRecord): Record<string, string | number> {
  return {
    id: profile.id,
    name: profile.name,
    protocol: profile.protocol,
    baseUrl: profile.baseUrl,
    modelId: profile.modelId,
    timeoutMs: profile.timeoutMs,
    outputMode: profile.outputMode,
    language: profile.language,
    maxInputSongs: profile.maxInputSongs,
    updatedAt: profile.updatedAt
  }
}
