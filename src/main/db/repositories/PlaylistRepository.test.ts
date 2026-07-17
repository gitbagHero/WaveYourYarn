import { afterEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDatabase } from '../testing/createTestDatabase'
import { SongRepository } from './SongRepository'
import { PlaylistRepository } from './PlaylistRepository'

describe('PlaylistRepository liked playlist reconciliation', () => {
  const databases: Database.Database[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('moves synthetic liked relations to the real liked playlist', () => {
    const db = createTestDatabase()
    databases.push(db)
    const playlistRepository = new PlaylistRepository(db)
    const songRepository = new SongRepository(db)
    songRepository.upsertSong({
      id: 'song-1',
      ncmSongId: 'song-1',
      name: 'Liked song',
      artists: ['Artist'],
      createdAt: 'now',
      updatedAt: 'now'
    })
    const synthetic = playlistRepository.upsertLikedPlaylist('user-1', 1)
    playlistRepository.replacePlaylistSongs(synthetic.id, [{ songId: 'song-1', orderIndex: 1 }])
    songRepository.upsertSong({
      id: 'real-song',
      ncmSongId: 'real-song',
      name: 'Real liked song',
      artists: ['Artist'],
      createdAt: 'now',
      updatedAt: 'now'
    })
    playlistRepository.upsertPlaylist({
      id: 'real-liked',
      ncmPlaylistId: '123456',
      name: 'User 的喜欢的音乐',
      ownerUserId: 'user-1',
      type: 'liked',
      createdAt: 'now',
      updatedAt: 'now'
    })
    playlistRepository.replacePlaylistSongs('real-liked', [
      { songId: 'real-song', orderIndex: 0 }
    ])

    playlistRepository.mergeSyntheticLikedPlaylist('user-1', 'real-liked')

    const liked = playlistRepository.getLikedPlaylist('user-1')
    expect(liked?.id).toBe('real-liked')
    expect(playlistRepository.getPlaylistSongs('real-liked').map((song) => song.id)).toEqual([
      'real-song',
      'song-1'
    ])
    expect(playlistRepository.findByNcmPlaylistId('liked:user-1')).toBeNull()
    expect(playlistRepository.findByType('liked')).toHaveLength(1)
  })

  it('removes playlists missing from a remote snapshot but keeps the synthetic liked cache', () => {
    const db = createTestDatabase()
    databases.push(db)
    const playlistRepository = new PlaylistRepository(db)
    playlistRepository.upsertLikedPlaylist('user-1', 0)
    playlistRepository.upsertPlaylist({
      id: 'kept',
      ncmPlaylistId: 'kept',
      name: 'Kept',
      type: 'created',
      createdAt: 'now',
      updatedAt: 'now'
    })
    playlistRepository.upsertPlaylist({
      id: 'removed',
      ncmPlaylistId: 'removed',
      name: 'Removed',
      type: 'subscribed',
      createdAt: 'now',
      updatedAt: 'now'
    })

    playlistRepository.removePlaylistsMissingFromSnapshot(['kept'], 'user-1')

    expect(playlistRepository.findByNcmPlaylistId('kept')).not.toBeNull()
    expect(playlistRepository.findByNcmPlaylistId('removed')).toBeNull()
    expect(playlistRepository.findByNcmPlaylistId('liked:user-1')).not.toBeNull()
  })
})
