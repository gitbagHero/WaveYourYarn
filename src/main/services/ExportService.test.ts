import { afterEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'

const electronMocks = vi.hoisted(() => ({
  openPath: vi.fn(async () => ''),
  showItemInFolder: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp'
  },
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn()
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString('utf8')
  },
  shell: {
    openPath: electronMocks.openPath,
    showItemInFolder: electronMocks.showItemInFolder
  }
}))

import { ExportRecordRepository } from '../db/repositories/ExportRecordRepository'
import { PlaylistRepository } from '../db/repositories/PlaylistRepository'
import { SettingsRepository } from '../db/repositories/SettingsRepository'
import { SongRepository } from '../db/repositories/SongRepository'
import { createTestDatabase } from '../db/testing/createTestDatabase'
import { NCMSongService } from '../adapters/ncm/NCMSongService'
import { ExportService } from './ExportService'
import { SecureStorageService } from './SecureStorageService'
import { SettingsService } from './SettingsService'
import { SongService } from './SongService'

describe('ExportService recorded-path boundary', () => {
  const databases: Database.Database[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('opens only paths resolved from an existing export record', async () => {
    const db = createTestDatabase()
    databases.push(db)
    const repository = new ExportRecordRepository(db)
    repository.create({
      id: 'record-1',
      exportType: 'json',
      filePath: '/exports/music.json',
      songCount: 1,
      createdAt: '2026-07-17T00:00:00.000Z'
    })
    const playlistRepository = new PlaylistRepository(db)
    const settingsRepository = new SettingsRepository(db)
    const songService = new SongService(
      new SongRepository(db),
      playlistRepository,
      settingsRepository,
      new SecureStorageService(settingsRepository),
      new NCMSongService(),
      db
    )
    const service = new ExportService(
      repository,
      songService,
      playlistRepository,
      new SettingsService(settingsRepository)
    )

    await service.openExportFile('record-1')
    await service.openExportFolder('record-1')

    expect(electronMocks.openPath).toHaveBeenCalledWith('/exports/music.json')
    expect(electronMocks.showItemInFolder).toHaveBeenCalledWith('/exports/music.json')
    await expect(service.openExportFile('/arbitrary/path')).rejects.toThrow('导出记录不存在')
    expect(electronMocks.openPath).toHaveBeenCalledTimes(1)
  })
})
