import type { Database } from 'better-sqlite3'
import { getDatabase } from '../database'
import type { AIDisclosureConsent, AIDisclosureSourceType, LLMProtocol } from '../../types/llm'

export interface AIDisclosureConsentScope {
  profileId: string
  targetOrigin: string
  protocol: LLMProtocol
  sourceType: AIDisclosureSourceType
  sourceId?: string
  fieldsHash: string
  maxInputSongs: number
}

export class AIDisclosureConsentRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  create(consent: AIDisclosureConsent): void {
    this.db
      .prepare(
        `INSERT INTO ai_disclosure_consents (
          id, profile_id, target_origin, protocol, source_type, source_id,
          fields_hash, max_input_songs, created_at, updated_at
        ) VALUES (
          @id, @profileId, @targetOrigin, @protocol, @sourceType, @sourceId,
          @fieldsHash, @maxInputSongs, @createdAt, @updatedAt
        )`
      )
      .run(toParameters(consent))
  }

  findMatching(scope: AIDisclosureConsentScope): AIDisclosureConsent | null {
    const row = this.db
      .prepare(
        `SELECT * FROM ai_disclosure_consents
         WHERE profile_id = @profileId
           AND target_origin = @targetOrigin
           AND protocol = @protocol
           AND source_type = @sourceType
           AND source_id IS @sourceId
           AND fields_hash = @fieldsHash
           AND max_input_songs >= @maxInputSongs
         ORDER BY max_input_songs ASC, updated_at DESC
         LIMIT 1`
      )
      .get({ ...scope, sourceId: scope.sourceId ?? null }) as AIDisclosureConsentRow | undefined
    return row ? fromRow(row) : null
  }

  deleteByProfileId(profileId: string): number {
    return this.db.prepare('DELETE FROM ai_disclosure_consents WHERE profile_id = ?').run(profileId)
      .changes
  }

  deleteAll(): number {
    return this.db.prepare('DELETE FROM ai_disclosure_consents').run().changes
  }
}

interface AIDisclosureConsentRow {
  id: string
  profile_id: string
  target_origin: string
  protocol: LLMProtocol
  source_type: AIDisclosureSourceType
  source_id: string | null
  fields_hash: string
  max_input_songs: number
  created_at: string
  updated_at: string
}

function fromRow(row: AIDisclosureConsentRow): AIDisclosureConsent {
  return {
    id: row.id,
    profileId: row.profile_id,
    targetOrigin: row.target_origin,
    protocol: row.protocol,
    sourceType: row.source_type,
    sourceId: row.source_id ?? undefined,
    fieldsHash: row.fields_hash,
    maxInputSongs: row.max_input_songs,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toParameters(consent: AIDisclosureConsent): Record<string, string | number | null> {
  return {
    id: consent.id,
    profileId: consent.profileId,
    targetOrigin: consent.targetOrigin,
    protocol: consent.protocol,
    sourceType: consent.sourceType,
    sourceId: consent.sourceId ?? null,
    fieldsHash: consent.fieldsHash,
    maxInputSongs: consent.maxInputSongs,
    createdAt: consent.createdAt,
    updatedAt: consent.updatedAt
  }
}
