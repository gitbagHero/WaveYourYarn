import { afterEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { ExportRecordRepository } from '../db/repositories/ExportRecordRepository'
import { PlaylistRepository } from '../db/repositories/PlaylistRepository'
import { SettingsRepository } from '../db/repositories/SettingsRepository'
import { SongRepository } from '../db/repositories/SongRepository'
import { UserRepository } from '../db/repositories/UserRepository'
import { createTestDatabase } from '../db/testing/createTestDatabase'
import type { Playlist } from '../types/playlist'
import type { Song } from '../types/song'
import { CACHE_OWNER_NCM_USER_ID_KEY, CacheOwnershipService } from './CacheOwnershipService'

describe('CacheOwnershipService', () => {
  const databases: Database.Database[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('preserves cache for the same account', () => {
    const fixture = createFixture()
    const { db, service, settingsRepository } = fixture
    databases.push(db)
    settingsRepository.set(CACHE_OWNER_NCM_USER_ID_KEY, 'user-1')
    seedMusicCache(fixture)

    expect(service.ensureOwner('user-1')).toEqual({ cacheReset: false })
    expect(fixture.songRepository.count()).toBe(1)
    expect(fixture.playlistRepository.count()).toBe(1)
    expect(fixture.exportRecordRepository.count()).toBe(1)
  })

  it('clears reproducible data while preserving public settings when the account changes', () => {
    const fixture = createFixture()
    const {
      db,
      service,
      settingsRepository,
      songRepository,
      playlistRepository,
      exportRecordRepository,
      userRepository
    } = fixture
    databases.push(db)
    settingsRepository.set(CACHE_OWNER_NCM_USER_ID_KEY, 'old-user')
    settingsRepository.set('liked_songs_last_synced_at', 'old-sync')
    settingsRepository.set('default_export_directory', '/exports')
    userRepository.upsertUser({ ncmUserId: 'old-user', nickname: 'Old user' })
    userRepository.upsertUser({ ncmUserId: 'new-user', nickname: 'New user' })
    seedMusicCache(fixture)

    expect(service.ensureOwner('new-user')).toEqual({ cacheReset: true })
    expect(songRepository.count()).toBe(0)
    expect(playlistRepository.count()).toBe(0)
    expect(exportRecordRepository.count()).toBe(0)
    expect(userRepository.count()).toBe(1)
    expect(userRepository.findByNcmUserId('new-user')).not.toBeNull()
    expect(settingsRepository.get(CACHE_OWNER_NCM_USER_ID_KEY)).toBe('new-user')
    expect(settingsRepository.get('liked_songs_last_synced_at')).toBeNull()
    expect(settingsRepository.get('default_export_directory')).toBe('/exports')
  })

  it('infers an unversioned v0.2.3 cache owner before deciding whether to clear it', () => {
    const fixture = createFixture()
    const { db, service, settingsRepository, playlistRepository, songRepository } = fixture
    databases.push(db)
    seedMusicCache(fixture, 'old-user')

    expect(service.ensureOwner('new-user')).toEqual({ cacheReset: true })
    expect(songRepository.count()).toBe(0)
    expect(playlistRepository.count()).toBe(0)
    expect(settingsRepository.get(CACHE_OWNER_NCM_USER_ID_KEY)).toBe('new-user')
  })

  it('preserves an unversioned v0.2.3 cache when its inferred owner logs in', () => {
    const fixture = createFixture()
    const { db, service, settingsRepository, playlistRepository, songRepository } = fixture
    databases.push(db)
    seedMusicCache(fixture, 'user-1')

    expect(service.ensureOwner('user-1')).toEqual({ cacheReset: false })
    expect(songRepository.count()).toBe(1)
    expect(playlistRepository.count()).toBe(1)
    expect(settingsRepository.get(CACHE_OWNER_NCM_USER_ID_KEY)).toBe('user-1')
  })

  it('clears legacy account data whose owner cannot be inferred', () => {
    const fixture = createFixture()
    const { db, service, settingsRepository, songRepository } = fixture
    databases.push(db)
    songRepository.upsertSong(createSong())

    expect(service.ensureOwner('user-1')).toEqual({ cacheReset: true })
    expect(songRepository.count()).toBe(0)
    expect(settingsRepository.get(CACHE_OWNER_NCM_USER_ID_KEY)).toBe('user-1')
  })
})

function createFixture(): {
  db: Database.Database
  service: CacheOwnershipService
  settingsRepository: SettingsRepository
  playlistRepository: PlaylistRepository
  songRepository: SongRepository
  exportRecordRepository: ExportRecordRepository
  userRepository: UserRepository
} {
  const db = createTestDatabase()
  const settingsRepository = new SettingsRepository(db)
  const playlistRepository = new PlaylistRepository(db)
  const songRepository = new SongRepository(db)
  const exportRecordRepository = new ExportRecordRepository(db)
  const userRepository = new UserRepository(db)

  return {
    db,
    settingsRepository,
    playlistRepository,
    songRepository,
    exportRecordRepository,
    userRepository,
    service: new CacheOwnershipService(
      settingsRepository,
      playlistRepository,
      songRepository,
      exportRecordRepository,
      userRepository,
      db
    )
  }
}

function seedMusicCache(fixture: ReturnType<typeof createFixture>, ownerUserId = 'user-1'): void {
  const song = createSong()
  const playlist: Playlist = {
    id: 'playlist-1',
    ncmPlaylistId: `liked:${ownerUserId}`,
    name: 'Liked Playlist',
    ownerUserId,
    type: 'liked',
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z'
  }

  fixture.songRepository.upsertSong(song)
  fixture.playlistRepository.upsertPlaylist(playlist)
  fixture.playlistRepository.replacePlaylistSongs(playlist.id, [
    { songId: song.id, orderIndex: 0 }
  ])
  fixture.exportRecordRepository.create({
    id: 'export-1',
    exportType: 'json',
    filePath: '/exports/songs.json',
    songCount: 1,
    sourceType: 'playlist',
    sourceId: playlist.id,
    sourceName: playlist.name,
    createdAt: '2026-07-17T00:00:00.000Z'
  })
}

function createSong(): Song {
  return {
    id: 'song-1',
    ncmSongId: 'song-1',
    name: 'Song',
    artists: ['Artist'],
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z'
  }
}
