import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp'
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString('utf8')
  }
}))

import { NCMPlaylistService } from '../adapters/ncm/NCMPlaylistService'
import { NCMSongService } from '../adapters/ncm/NCMSongService'
import { PlaylistRepository } from '../db/repositories/PlaylistRepository'
import { SettingsRepository } from '../db/repositories/SettingsRepository'
import { SongRepository } from '../db/repositories/SongRepository'
import { createTestDatabase } from '../db/testing/createTestDatabase'
import type { Playlist } from '../types/playlist'
import type { Song } from '../types/song'
import { PlaylistService } from './PlaylistService'
import { SecureStorageService } from './SecureStorageService'

describe('PlaylistService cache clearing', () => {
  const databases: ReturnType<typeof createTestDatabase>[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('preserves liked songs when clearing non-liked playlists', async () => {
    const context = createContext()
    const { db, playlistRepository, songRepository, service } = context
    databases.push(db)
    const likedOnly = createSong('liked-only')
    const shared = createSong('shared')
    const playlistOnly = createSong('playlist-only')
    songRepository.upsertSongs([likedOnly, shared, playlistOnly])
    const likedPlaylist = playlistRepository.upsertLikedPlaylist('user-1', 2)
    const normalPlaylist = createPlaylist()
    playlistRepository.upsertPlaylist(normalPlaylist)
    playlistRepository.replacePlaylistSongs(likedPlaylist.id, [
      { songId: likedOnly.id, orderIndex: 0 },
      { songId: shared.id, orderIndex: 1 }
    ])
    playlistRepository.replacePlaylistSongs(normalPlaylist.id, [
      { songId: shared.id, orderIndex: 0 },
      { songId: playlistOnly.id, orderIndex: 1 }
    ])

    await service.clearPlaylistCache()

    expect(playlistRepository.findById(normalPlaylist.id)).toBeNull()
    expect(playlistRepository.getPlaylistSongs(likedPlaylist.id).map((song) => song.id)).toEqual([
      likedOnly.id,
      shared.id
    ])
    expect(songRepository.findByNcmSongId(likedOnly.ncmSongId)).not.toBeNull()
    expect(songRepository.findByNcmSongId(shared.ncmSongId)).not.toBeNull()
    expect(songRepository.findByNcmSongId(playlistOnly.ncmSongId)).toBeNull()
  })

  it('removes orphan songs when clearing one playlist track cache', async () => {
    const context = createContext()
    const { db, playlistRepository, songRepository, service } = context
    databases.push(db)
    const playlist = createPlaylist()
    const song = createSong('playlist-only')
    playlistRepository.upsertPlaylist(playlist)
    songRepository.upsertSong(song)
    playlistRepository.replacePlaylistSongs(playlist.id, [{ songId: song.id, orderIndex: 0 }])

    await service.clearPlaylistSongsCache(playlist.id)

    expect(playlistRepository.findById(playlist.id)).not.toBeNull()
    expect(playlistRepository.getPlaylistSongs(playlist.id)).toEqual([])
    expect(songRepository.findByNcmSongId(song.ncmSongId)).toBeNull()
  })
})

function createContext(): {
  db: ReturnType<typeof createTestDatabase>
  playlistRepository: PlaylistRepository
  songRepository: SongRepository
  service: PlaylistService
} {
  const db = createTestDatabase()
  const playlistRepository = new PlaylistRepository(db)
  const songRepository = new SongRepository(db)
  const settingsRepository = new SettingsRepository(db)
  const service = new PlaylistService(
    playlistRepository,
    songRepository,
    settingsRepository,
    new SecureStorageService(settingsRepository),
    new NCMPlaylistService(),
    new NCMSongService(),
    db
  )

  return { db, playlistRepository, songRepository, service }
}

function createSong(id: string): Song {
  return {
    id,
    ncmSongId: id,
    name: id,
    artists: ['Artist'],
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z'
  }
}

function createPlaylist(): Playlist {
  return {
    id: 'playlist-1',
    ncmPlaylistId: 'playlist-1',
    name: 'Normal playlist',
    type: 'created',
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z'
  }
}
