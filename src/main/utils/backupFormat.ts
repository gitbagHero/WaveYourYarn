import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { open, rename, rm, stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupDataCounts,
  type BackupManifest
} from '../types/backup'

const BACKUP_MAGIC = Buffer.from('WYYBACKUP\n', 'utf8')
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0', 'utf8')
const MANIFEST_LENGTH_BYTES = 4
const MAX_MANIFEST_BYTES = 64 * 1024
const MAX_DATABASE_BYTES = 4 * 1024 * 1024 * 1024

export interface BackupManifestInput {
  appVersion: string
  schemaVersion: number
  createdAt: string
  sourcePlatform: string
  counts: BackupDataCounts
}

export async function createBackupArchive(
  databasePath: string,
  destinationPath: string,
  input: BackupManifestInput
): Promise<BackupManifest> {
  const databaseInfo = await stat(databasePath)

  if (!databaseInfo.isFile() || databaseInfo.size <= SQLITE_MAGIC.length) {
    throw new Error('数据库快照为空或格式无效')
  }

  if (databaseInfo.size > MAX_DATABASE_BYTES) {
    throw new Error('数据库快照超过备份大小限制')
  }

  await assertSqliteHeader(databasePath)
  const databaseSha256 = await sha256File(databasePath)
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: input.appVersion,
    schemaVersion: input.schemaVersion,
    createdAt: input.createdAt,
    sourcePlatform: input.sourcePlatform,
    databaseSizeBytes: databaseInfo.size,
    databaseSha256,
    counts: input.counts
  }
  const manifestBuffer = Buffer.from(JSON.stringify(manifest), 'utf8')

  if (manifestBuffer.length > MAX_MANIFEST_BYTES) {
    throw new Error('备份 manifest 超过大小限制')
  }

  const manifestLength = Buffer.alloc(MANIFEST_LENGTH_BYTES)
  manifestLength.writeUInt32BE(manifestBuffer.length)
  const temporaryPath = `${destinationPath}.tmp-${randomUUID()}`

  try {
    const output = createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 })
    output.write(BACKUP_MAGIC)
    output.write(manifestLength)
    output.write(manifestBuffer)
    await pipeline(createReadStream(databasePath), output)
    await rm(destinationPath, { force: true })
    await rename(temporaryPath, destinationPath)
    return manifest
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

export async function extractBackupArchive(
  backupPath: string,
  destinationDatabasePath: string
): Promise<BackupManifest> {
  const backupInfo = await stat(backupPath)

  if (!backupInfo.isFile()) {
    throw new Error('选择的备份不是文件')
  }

  const file = await open(backupPath, 'r')
  let manifest: BackupManifest
  let databaseOffset: number

  try {
    const magic = Buffer.alloc(BACKUP_MAGIC.length)
    await readExactly(file, magic, 0)

    if (!magic.equals(BACKUP_MAGIC)) {
      throw new Error('不是有效的 WaveYourYarn 备份文件')
    }

    const manifestLengthBuffer = Buffer.alloc(MANIFEST_LENGTH_BYTES)
    await readExactly(file, manifestLengthBuffer, BACKUP_MAGIC.length)
    const manifestLength = manifestLengthBuffer.readUInt32BE(0)

    if (manifestLength <= 0 || manifestLength > MAX_MANIFEST_BYTES) {
      throw new Error('备份 manifest 长度无效')
    }

    const manifestBuffer = Buffer.alloc(manifestLength)
    await readExactly(file, manifestBuffer, BACKUP_MAGIC.length + MANIFEST_LENGTH_BYTES)
    manifest = parseBackupManifest(manifestBuffer.toString('utf8'))
    databaseOffset = BACKUP_MAGIC.length + MANIFEST_LENGTH_BYTES + manifestLength

    if (manifest.databaseSizeBytes > MAX_DATABASE_BYTES) {
      throw new Error('备份数据库超过大小限制')
    }

    if (backupInfo.size !== databaseOffset + manifest.databaseSizeBytes) {
      throw new Error('备份文件大小与 manifest 不一致')
    }
  } finally {
    await file.close()
  }

  await rm(destinationDatabasePath, { force: true })

  try {
    await pipeline(
      createReadStream(backupPath, { start: databaseOffset }),
      createWriteStream(destinationDatabasePath, { flags: 'wx', mode: 0o600 })
    )
    await assertSqliteHeader(destinationDatabasePath)
    const extractedSha256 = await sha256File(destinationDatabasePath)

    if (extractedSha256 !== manifest.databaseSha256) {
      throw new Error('备份数据库校验值不匹配，文件可能已损坏')
    }

    return manifest
  } catch (error) {
    await rm(destinationDatabasePath, { force: true })
    throw error
  }
}

export function parseBackupManifest(value: string): BackupManifest {
  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('备份 manifest 不是有效 JSON')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('备份 manifest 格式无效')
  }

  const record = parsed as Record<string, unknown>

  if (record.format !== BACKUP_FORMAT) {
    throw new Error('备份格式标识无效')
  }

  if (record.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error(`不支持的备份格式版本：${String(record.formatVersion)}`)
  }

  const counts = parseCounts(record.counts)
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: requireNonEmptyString(record.appVersion, '应用版本'),
    schemaVersion: requireNonNegativeInteger(record.schemaVersion, '数据库 schema 版本'),
    createdAt: requireIsoDate(record.createdAt),
    sourcePlatform: requireNonEmptyString(record.sourcePlatform, '来源平台'),
    databaseSizeBytes: requirePositiveInteger(record.databaseSizeBytes, '数据库大小'),
    databaseSha256: requireSha256(record.databaseSha256),
    counts
  }

  return manifest
}

async function assertSqliteHeader(filePath: string): Promise<void> {
  const file = await open(filePath, 'r')

  try {
    const header = Buffer.alloc(SQLITE_MAGIC.length)
    await readExactly(file, header, 0)

    if (!header.equals(SQLITE_MAGIC)) {
      throw new Error('备份内容不是有效的 SQLite 数据库')
    }
  } finally {
    await file.close()
  }
}

async function readExactly(
  file: Awaited<ReturnType<typeof open>>,
  buffer: Buffer,
  position: number
): Promise<void> {
  const { bytesRead } = await file.read(buffer, 0, buffer.length, position)

  if (bytesRead !== buffer.length) {
    throw new Error('备份文件内容不完整')
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256')

  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer)
  }

  return hash.digest('hex')
}

function parseCounts(value: unknown): BackupDataCounts {
  if (!value || typeof value !== 'object') {
    throw new Error('备份数据数量摘要无效')
  }

  const counts = value as Record<string, unknown>
  return {
    users: requireNonNegativeInteger(counts.users, '用户数量'),
    songs: requireNonNegativeInteger(counts.songs, '歌曲数量'),
    playlists: requireNonNegativeInteger(counts.playlists, '歌单数量'),
    playlistSongs: requireNonNegativeInteger(counts.playlistSongs, '歌单歌曲关系数量'),
    exportRecords: requireNonNegativeInteger(counts.exportRecords, '导出记录数量'),
    publicSettings: requireNonNegativeInteger(counts.publicSettings, '公开设置数量')
  }
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`备份 ${label}无效`)
  }

  return value
}

function requireIsoDate(value: unknown): string {
  const date = requireNonEmptyString(value, '创建时间')

  if (Number.isNaN(Date.parse(date))) {
    throw new Error('备份创建时间无效')
  }

  return date
}

function requireSha256(value: unknown): string {
  const sha256 = requireNonEmptyString(value, 'SHA-256')

  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error('备份 SHA-256 无效')
  }

  return sha256
}

function requirePositiveInteger(value: unknown, label: string): number {
  const number = requireNonNegativeInteger(value, label)

  if (number <= 0) {
    throw new Error(`备份 ${label}无效`)
  }

  return number
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`备份 ${label}无效`)
  }

  return value
}
