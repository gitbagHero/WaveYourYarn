import { createRequire } from 'node:module'
import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type {
  BackupDatabaseGateway,
  BackupDatabaseSummary
} from '../db/backupDatabase'
import { BackupService } from './BackupService'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
const summary: BackupDatabaseSummary = {
  schemaVersion: 6,
  counts: {
    users: 1,
    songs: 1,
    playlists: 1,
    playlistSongs: 1,
    exportRecords: 0,
    publicSettings: 1
  }
}

describe('BackupService', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true })
      )
    )
  })

  it('creates, inspects and restores a validated archive while keeping an emergency copy', async () => {
    const directory = await createTemporaryDirectory(temporaryDirectories)
    const sourcePath = join(directory, 'source.db')
    const activePath = join(directory, 'active.db')
    const archivePath = join(directory, 'backup.wyybackup')
    createSqliteFixture(sourcePath, 'backup-data')
    createSqliteFixture(activePath, 'current-data')
    const gateway = new FakeBackupGateway(sourcePath, activePath)
    const service = new BackupService(gateway, {
      databasePath: activePath,
      appDataDirectory: directory
    })

    const created = await service.createBackup(archivePath, '0.2.5', 'test-platform')
    const preview = await service.inspectBackup(archivePath)
    const restored = await service.restoreBackup(archivePath)

    expect(created.fileName).toBe('backup.wyybackup')
    expect(preview.counts).toEqual(summary.counts)
    expect(restored.restartRequired).toBe(true)
    expect(gateway.closed).toBe(true)
    expect(readFixtureValue(activePath)).toBe('backup-data')
    const emergencyPath = join(directory, 'recovery', restored.emergencyBackupFileName)
    expect(readFixtureValue(emergencyPath)).toBe('current-data')
  })

  it('does not touch the active database when archive validation fails', async () => {
    const directory = await createTemporaryDirectory(temporaryDirectories)
    const sourcePath = join(directory, 'source.db')
    const activePath = join(directory, 'active.db')
    const invalidPath = join(directory, 'invalid.wyybackup')
    createSqliteFixture(sourcePath, 'backup-data')
    createSqliteFixture(activePath, 'current-data')
    await copyFile(sourcePath, invalidPath)
    const gateway = new FakeBackupGateway(sourcePath, activePath)
    const service = new BackupService(gateway, {
      databasePath: activePath,
      appDataDirectory: directory
    })

    await expect(service.restoreBackup(invalidPath)).rejects.toThrow('不是有效的')
    expect(gateway.closed).toBe(false)
    expect(readFixtureValue(activePath)).toBe('current-data')
  })

  it('rejects using the active database path as a backup destination', async () => {
    const directory = await createTemporaryDirectory(temporaryDirectories)
    const sourcePath = join(directory, 'source.db')
    const activePath = join(directory, 'active.db')
    createSqliteFixture(sourcePath, 'backup-data')
    createSqliteFixture(activePath, 'current-data')
    const service = new BackupService(new FakeBackupGateway(sourcePath, activePath), {
      databasePath: activePath,
      appDataDirectory: directory
    })

    await expect(service.createBackup(activePath, '0.2.5', 'test')).rejects.toThrow(
      '不能直接使用当前数据库文件'
    )
  })
})

class FakeBackupGateway implements BackupDatabaseGateway {
  closed = false

  constructor(
    private readonly sourcePath: string,
    private readonly activePath: string
  ) {}

  async createSanitizedSnapshot(destinationPath: string): Promise<BackupDatabaseSummary> {
    await copyFile(this.sourcePath, destinationPath)
    return summary
  }

  async createEmergencySnapshot(destinationPath: string): Promise<void> {
    await copyFile(this.activePath, destinationPath)
  }

  inspectSnapshot(): BackupDatabaseSummary {
    return summary
  }

  prepareRestoreSnapshot(): BackupDatabaseSummary {
    return summary
  }

  closeActiveDatabase(): void {
    this.closed = true
  }
}

async function createTemporaryDirectory(registry: string[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'waveyouryarn-backup-service-'))
  registry.push(directory)
  return directory
}

function createSqliteFixture(filePath: string, value: string): void {
  const db = new DatabaseSync(filePath)
  db.exec('CREATE TABLE fixture (value TEXT NOT NULL)')
  db.prepare('INSERT INTO fixture VALUES (?)').run(value)
  db.close()
}

function readFixtureValue(filePath: string): string {
  const db = new DatabaseSync(filePath, { readOnly: true })
  const row = db.prepare('SELECT value FROM fixture').get() as { value: string }
  db.close()
  return row.value
}
