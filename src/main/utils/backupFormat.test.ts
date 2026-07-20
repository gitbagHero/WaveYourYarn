import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBackupArchive, extractBackupArchive, parseBackupManifest } from './backupFormat'
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, type BackupDataCounts } from '../types/backup'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
const counts: BackupDataCounts = {
  users: 1,
  songs: 2,
  playlists: 1,
  playlistSongs: 2,
  exportRecords: 0,
  publicSettings: 1
}

describe('WaveYourYarn backup archive format', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true })
      )
    )
  })

  it('round-trips a SQLite snapshot with a versioned manifest and checksum', async () => {
    const directory = await createTemporaryDirectory(temporaryDirectories)
    const databasePath = join(directory, 'source.db')
    const archivePath = join(directory, 'backup.wyybackup')
    const extractedPath = join(directory, 'extracted.db')
    createSqliteFixture(databasePath)

    const created = await createBackupArchive(databasePath, archivePath, {
      appVersion: '0.2.5',
      schemaVersion: 6,
      createdAt: '2026-07-20T00:00:00.000Z',
      sourcePlatform: 'darwin-arm64',
      counts
    })
    const extracted = await extractBackupArchive(archivePath, extractedPath)

    expect(extracted).toEqual(created)
    expect(extracted.format).toBe(BACKUP_FORMAT)
    expect(extracted.formatVersion).toBe(BACKUP_FORMAT_VERSION)
    expect(extracted.databaseSha256).toMatch(/^[a-f0-9]{64}$/)
    const db = new DatabaseSync(extractedPath, { readOnly: true })
    const row = db.prepare('SELECT value FROM fixture').get() as { value: string }
    db.close()
    expect(row.value).toBe('preserved')
  })

  it('rejects an archive whose SQLite payload was modified', async () => {
    const directory = await createTemporaryDirectory(temporaryDirectories)
    const databasePath = join(directory, 'source.db')
    const archivePath = join(directory, 'backup.wyybackup')
    const extractedPath = join(directory, 'extracted.db')
    createSqliteFixture(databasePath)
    await createBackupArchive(databasePath, archivePath, {
      appVersion: '0.2.5',
      schemaVersion: 6,
      createdAt: '2026-07-20T00:00:00.000Z',
      sourcePlatform: 'darwin-arm64',
      counts
    })
    const archive = await readFile(archivePath)
    archive[archive.length - 1] ^= 0xff
    await writeFile(archivePath, archive)

    await expect(extractBackupArchive(archivePath, extractedPath)).rejects.toThrow(
      '校验值不匹配'
    )
  })

  it('rejects invalid magic and unsupported manifest versions', async () => {
    const directory = await createTemporaryDirectory(temporaryDirectories)
    const invalidPath = join(directory, 'invalid.wyybackup')
    await writeFile(invalidPath, 'not-a-backup')

    await expect(
      extractBackupArchive(invalidPath, join(directory, 'invalid.db'))
    ).rejects.toThrow('不是有效的 WaveYourYarn 备份文件')

    expect(() =>
      parseBackupManifest(
        JSON.stringify({
          format: BACKUP_FORMAT,
          formatVersion: 99
        })
      )
    ).toThrow('不支持的备份格式版本')
  })
})

async function createTemporaryDirectory(registry: string[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'waveyouryarn-backup-format-'))
  registry.push(directory)
  return directory
}

function createSqliteFixture(filePath: string): void {
  const db = new DatabaseSync(filePath)
  db.exec("CREATE TABLE fixture (value TEXT NOT NULL); INSERT INTO fixture VALUES ('preserved');")
  db.close()
}
