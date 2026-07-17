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

import { NCMSongService } from '../adapters/ncm/NCMSongService'
import { PlaylistRepository } from '../db/repositories/PlaylistRepository'
import { SettingsRepository } from '../db/repositories/SettingsRepository'
import { SongRepository } from '../db/repositories/SongRepository'
import { createTestDatabase } from '../db/testing/createTestDatabase'
import type { Playlist } from '../types/playlist'
import type { Song } from '../types/song'
import { SecureStorageService } from './SecureStorageService'
import { SongService } from './SongService'

describe('SongService.clearLikedSongsCache', () => {
  const databases: ReturnType<typeof createTestDatabase>[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('preserves songs and relations used by non-liked playlists', async () => {
    const db = createTestDatabase()
    databases.push(db)
    const songRepository = new SongRepository(db)
    const playlistRepository = new PlaylistRepository(db)
    const settingsRepository = new SettingsRepository(db)
    const songs = [
      createSong('shared', 'Shared song'),
      createSong('liked-only', 'Liked only'),
      createSong('playlist-only', 'Playlist only')
    ]

    songRepository.upsertSongs(songs)
    const likedPlaylist = playlistRepository.upsertLikedPlaylist('user-1', 2)
    const normalPlaylist = createPlaylist()
    playlistRepository.upsertPlaylist(normalPlaylist)
    playlistRepository.replacePlaylistSongs(likedPlaylist.id, [
      { songId: 'shared', orderIndex: 0 },
      { songId: 'liked-only', orderIndex: 1 }
    ])
    playlistRepository.replacePlaylistSongs(normalPlaylist.id, [
      { songId: 'shared', orderIndex: 0 },
      { songId: 'playlist-only', orderIndex: 1 }
    ])

    const service = new SongService(
      songRepository,
      playlistRepository,
      settingsRepository,
      new SecureStorageService(settingsRepository),
      new NCMSongService(),
      db
    )

    await service.clearLikedSongsCache()

    expect(playlistRepository.getLikedPlaylist('user-1')).toBeNull()
    expect(playlistRepository.getPlaylistSongs(normalPlaylist.id).map((song) => song.id)).toEqual([
      'shared',
      'playlist-only'
    ])
    expect(songRepository.findByNcmSongId('shared')).not.toBeNull()
    expect(songRepository.findByNcmSongId('playlist-only')).not.toBeNull()
    expect(songRepository.findByNcmSongId('liked-only')).toBeNull()
    expect(songRepository.count()).toBe(2)
  })

  it('uses the cache owner for offline liked-song reads instead of returning every song', async () => {
    const db = createTestDatabase()
    databases.push(db)
    const songRepository = new SongRepository(db)
    const playlistRepository = new PlaylistRepository(db)
    const settingsRepository = new SettingsRepository(db)
    const likedSong = createSong('liked', 'Liked song')
    const unrelatedSong = createSong('unrelated', 'Unrelated song')
    songRepository.upsertSongs([likedSong, unrelatedSong])
    const likedPlaylist = playlistRepository.upsertLikedPlaylist('user-1', 1)
    playlistRepository.replacePlaylistSongs(likedPlaylist.id, [
      { songId: likedSong.id, orderIndex: 0 }
    ])
    settingsRepository.set('cache_owner_ncm_user_id', 'user-1')
    const service = new SongService(
      songRepository,
      playlistRepository,
      settingsRepository,
      new SecureStorageService(settingsRepository),
      new NCMSongService(),
      db
    )

    const songs = await service.getLikedSongs()

    expect(songs.map((song) => song.id)).toEqual(['liked'])
  })
})

function createSong(id: string, name: string): Song {
  return {
    id,
    ncmSongId: id,
    name,
    artists: ['Artist'],
    album: 'Album',
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
