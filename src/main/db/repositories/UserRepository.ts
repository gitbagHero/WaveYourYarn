import type { Database } from 'better-sqlite3'
import { nanoid } from 'nanoid'
import { getDatabase } from '../database'
import type { UserProfile } from '../../types/user'
import { nowIso } from '../../utils/time'

export class UserRepository {
  constructor(private readonly db: Database = getDatabase()) {}

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
    return row.count
  }

  findByNcmUserId(ncmUserId: string): UserProfile | null {
    const row = this.db
      .prepare(
        `SELECT id, ncm_user_id, nickname, avatar_url, created_at, updated_at
         FROM users
         WHERE ncm_user_id = ?`
      )
      .get(ncmUserId) as UserRow | undefined

    return row ? toUserProfile(row) : null
  }

  upsertUser(user: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> & Partial<UserProfile>): UserProfile {
    const existing = this.findByNcmUserId(user.ncmUserId)
    const timestamp = nowIso()
    const nextUser: UserProfile = {
      id: existing?.id ?? user.id ?? nanoid(),
      ncmUserId: user.ncmUserId,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      createdAt: existing?.createdAt ?? user.createdAt ?? timestamp,
      updatedAt: timestamp
    }

    this.db
      .prepare(
        `INSERT INTO users (id, ncm_user_id, nickname, avatar_url, raw_data, created_at, updated_at)
         VALUES (@id, @ncmUserId, @nickname, @avatarUrl, @rawData, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           ncm_user_id = excluded.ncm_user_id,
           nickname = excluded.nickname,
           avatar_url = excluded.avatar_url,
           raw_data = excluded.raw_data,
           updated_at = excluded.updated_at`
      )
      .run({
        ...nextUser,
        avatarUrl: nextUser.avatarUrl ?? null,
        rawData: JSON.stringify(user)
      })

    return nextUser
  }

  getLastLoginUser(): UserProfile | null {
    const row = this.db
      .prepare(
        `SELECT id, ncm_user_id, nickname, avatar_url, created_at, updated_at
         FROM users
         ORDER BY updated_at DESC
         LIMIT 1`
      )
      .get() as UserRow | undefined

    return row ? toUserProfile(row) : null
  }

  clearUsers(): void {
    this.db.prepare('DELETE FROM users').run()
  }
}

interface UserRow {
  id: string
  ncm_user_id: string
  nickname: string
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

function toUserProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    ncmUserId: row.ncm_user_id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
