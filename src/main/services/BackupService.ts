import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import {
  SQLiteBackupDatabaseGateway,
  type BackupDatabaseGateway,
  type BackupDatabaseSummary
} from '../db/backupDatabase'
import type {
  BackupCreateResult,
  BackupManifest,
  BackupPreview,
  BackupRestoreResult
} from '../types/backup'
import { createBackupArchive, extractBackupArchive } from '../utils/backupFormat'
import { replaceFileWithRollback } from '../utils/atomicFileReplacement'
import { logger } from '../utils/logger'
import { nowIso } from '../utils/time'

export interface BackupServicePaths {
  databasePath: string
  appDataDirectory: string
}

export class DatabaseSwapRequiresRestartError extends Error {
  readonly requiresRestart = true

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DatabaseSwapRequiresRestartError'
  }
}

export class BackupService {
  private operationInProgress = false

  constructor(
    private readonly gateway: BackupDatabaseGateway = new SQLiteBackupDatabaseGateway(),
    private readonly paths: BackupServicePaths
  ) {}

  async createBackup(
    destinationPath: string,
    appVersion: string,
    sourcePlatform: string
  ): Promise<BackupCreateResult> {
    return this.runExclusive(async () => {
      assertDifferentPath(destinationPath, this.paths.databasePath)
      const temporaryDirectory = await mkdtemp(join(tmpdir(), 'waveyouryarn-backup-'))
      const snapshotPath = join(temporaryDirectory, 'snapshot.db')

      try {
        const summary = await this.gateway.createSanitizedSnapshot(snapshotPath)
        const manifest = await createBackupArchive(snapshotPath, destinationPath, {
          appVersion,
          schemaVersion: summary.schemaVersion,
          createdAt: nowIso(),
          sourcePlatform,
          counts: summary.counts
        })
        logger.info('数据库备份已创建', {
          fileName: basename(destinationPath),
          schemaVersion: manifest.schemaVersion,
          songs: manifest.counts.songs,
          playlists: manifest.counts.playlists
        })
        return {
          fileName: basename(destinationPath),
          manifest
        }
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true })
      }
    })
  }

  async inspectBackup(backupPath: string): Promise<BackupPreview> {
    return this.runExclusive(async () => {
      assertDifferentPath(backupPath, this.paths.databasePath)
      const temporaryDirectory = await mkdtemp(join(tmpdir(), 'waveyouryarn-inspect-'))
      const snapshotPath = join(temporaryDirectory, 'snapshot.db')

      try {
        const manifest = await extractBackupArchive(backupPath, snapshotPath)
        const summary = this.gateway.inspectSnapshot(snapshotPath)
        assertManifestMatchesSummary(manifest, summary)
        return {
          ...manifest,
          fileName: basename(backupPath)
        }
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true })
      }
    })
  }

  async restoreBackup(backupPath: string): Promise<BackupRestoreResult> {
    return this.runExclusive(async () => {
      assertDifferentPath(backupPath, this.paths.databasePath)
      const temporaryDirectory = await mkdtemp(join(tmpdir(), 'waveyouryarn-restore-'))
      const extractedPath = join(temporaryDirectory, 'restore.db')
      const replacementPath = join(
        dirname(this.paths.databasePath),
        `.waveyouryarn.restore-next-${randomUUID()}.db`
      )
      let databaseClosed = false

      try {
        const manifest = await extractBackupArchive(backupPath, extractedPath)
        const inspected = this.gateway.inspectSnapshot(extractedPath)
        assertManifestMatchesSummary(manifest, inspected)
        const prepared = this.gateway.prepareRestoreSnapshot(extractedPath)
        assertCountsEqual(manifest.counts, prepared.counts)

        const recoveryDirectory = join(this.paths.appDataDirectory, 'recovery')
        await mkdir(recoveryDirectory, { recursive: true })
        const timestamp = nowIso().replace(/[:.]/g, '-')
        const emergencyBackupPath = join(
          recoveryDirectory,
          `waveyouryarn-before-restore-${timestamp}.db`
        )
        await this.gateway.createEmergencySnapshot(emergencyBackupPath)
        await copyFile(extractedPath, replacementPath)

        this.gateway.closeActiveDatabase()
        databaseClosed = true
        await rm(`${this.paths.databasePath}-wal`, { force: true })
        await rm(`${this.paths.databasePath}-shm`, { force: true })
        await replaceFileWithRollback(this.paths.databasePath, replacementPath)
        logger.info('数据库恢复完成，应用需要重启', {
          schemaVersion: prepared.schemaVersion,
          songs: prepared.counts.songs,
          playlists: prepared.counts.playlists,
          emergencyBackupFileName: basename(emergencyBackupPath)
        })
        return {
          restoredAt: nowIso(),
          emergencyBackupFileName: basename(emergencyBackupPath),
          restartRequired: true
        }
      } catch (error) {
        if (databaseClosed) {
          throw new DatabaseSwapRequiresRestartError(
            '数据库替换失败，已尝试恢复原数据库，应用将重启',
            { cause: error }
          )
        }

        throw error
      } finally {
        await rm(replacementPath, { force: true })
        await rm(temporaryDirectory, { recursive: true, force: true })
      }
    })
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.operationInProgress) {
      throw new Error('已有数据库备份或恢复操作正在进行')
    }

    this.operationInProgress = true

    try {
      return await operation()
    } finally {
      this.operationInProgress = false
    }
  }
}

function assertManifestMatchesSummary(
  manifest: BackupManifest,
  summary: BackupDatabaseSummary
): void {
  if (manifest.schemaVersion !== summary.schemaVersion) {
    throw new Error('备份 manifest 与数据库 schema 版本不一致')
  }

  assertCountsEqual(manifest.counts, summary.counts)
}

function assertCountsEqual(
  expected: BackupManifest['counts'],
  actual: BackupManifest['counts']
): void {
  for (const key of Object.keys(expected) as Array<keyof BackupManifest['counts']>) {
    if (expected[key] !== actual[key]) {
      throw new Error(`备份 manifest 与数据库 ${key} 数量不一致`)
    }
  }
}

function assertDifferentPath(candidatePath: string, databasePath: string): void {
  if (resolve(candidatePath) === resolve(databasePath)) {
    throw new Error('不能直接使用当前数据库文件作为备份或恢复文件')
  }
}
