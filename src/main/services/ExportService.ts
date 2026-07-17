import { app, dialog, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { nanoid } from 'nanoid'
import { ExportRecordRepository } from '../db/repositories/ExportRecordRepository'
import { PlaylistRepository } from '../db/repositories/PlaylistRepository'
import type {
  ExportFormat,
  ExportOptions,
  ExportRecord,
  ExportResult,
  ExportSortMode,
  ExportSourceType
} from '../types/export'
import type { LikedSong, PlaylistTrack } from '../types/song'
import { logger } from '../utils/logger'
import { nowIso } from '../utils/time'
import { SongService } from './SongService'
import { SettingsService } from './SettingsService'

const EXPORT_CANCELLED_MESSAGE = '导出已取消'
export const EXPORT_CANCELLED_CODE = 'EXPORT_CANCELLED'

type ExportableSong = LikedSong | PlaylistTrack

interface ExportData {
  sourceType: ExportSourceType
  sourceId?: string
  sourceName: string
  songs: ExportableSong[]
  timeColumnName: string
  timeType: 'likedAt' | 'addedAt'
}

interface ExportSongRow {
  index: number
  name: string
  artistNames: string[]
  artists: string
  album: string
  duration: string
  durationMs?: number
  time: string
  timeTimestamp?: number
  ncmSongId: string
  coverUrl: string
  orderIndex: number
}

export class ExportService {
  constructor(
    private readonly exportRecordRepository = new ExportRecordRepository(),
    private readonly songService = new SongService(),
    private readonly playlistRepository = new PlaylistRepository(),
    private readonly settingsService = new SettingsService()
  ) {}

  getExportRecordCount(): number {
    return this.exportRecordRepository.count()
  }

  async exportSongs(options: ExportOptions): Promise<ExportResult> {
    const normalizedOptions = normalizeExportOptions(options)
    const exportData = await this.getSongsForExport(normalizedOptions)
    const filteredSongs =
      normalizedOptions.scope === 'filtered'
        ? filterSongs(exportData.songs, normalizedOptions.keyword ?? '')
        : exportData.songs
    const songs = sortExportSongs(filteredSongs, exportData.sourceType, normalizedOptions.sortMode)

    if (exportData.songs.length === 0) {
      throw new Error(
        exportData.sourceType === 'liked'
          ? '当前还没有同步“我喜欢的音乐”，请先同步后再导出'
          : '当前歌单还没有同步歌曲，请先进入歌单详情页同步后再导出'
      )
    }

    if (songs.length === 0) {
      throw new Error('没有找到符合关键词的歌曲，请调整搜索条件')
    }

    const filePath =
      normalizedOptions.filePath ??
      (await this.selectExportFilePath(normalizedOptions.format, exportData.sourceName))

    logger.info('开始导出歌曲', {
      sourceType: exportData.sourceType,
      sourceName: exportData.sourceName,
      format: normalizedOptions.format,
      scope: normalizedOptions.scope,
      sortMode: normalizedOptions.sortMode,
      count: songs.length,
      extension: extname(filePath)
    })

    if (normalizedOptions.format === 'csv') {
      await this.exportCsv(songs, filePath, exportData)
    } else if (normalizedOptions.format === 'json') {
      await this.exportJson(songs, filePath, normalizedOptions, exportData)
    } else {
      await this.exportMarkdown(songs, filePath, normalizedOptions.sortMode, exportData)
    }

    const exportedAt = nowIso()
    const record: ExportRecord = {
      id: nanoid(),
      exportType: normalizedOptions.format,
      filePath,
      songCount: songs.length,
      sourceType: exportData.sourceType,
      sourceId: exportData.sourceId,
      sourceName: exportData.sourceName,
      scope: normalizedOptions.scope,
      sortMode: normalizeSortMode(normalizedOptions.sortMode),
      createdAt: exportedAt
    }

    try {
      this.exportRecordRepository.create(record)
    } catch (error) {
      logger.warn('导出文件已生成，但导出记录保存失败', error)
      throw new Error(`文件已导出，但记录保存失败：${filePath}`)
    }

    logger.info('导出歌曲完成', {
      sourceType: exportData.sourceType,
      format: normalizedOptions.format,
      count: songs.length,
      fileName: basename(filePath)
    })

    return {
      id: record.id,
      format: record.exportType,
      filePath: record.filePath,
      songCount: record.songCount,
      exportedAt,
      sourceType: record.sourceType ?? 'liked',
      sourceId: record.sourceId,
      sourceName: record.sourceName ?? '我喜欢的音乐'
    }
  }

  async exportLikedSongs(options: Omit<ExportOptions, 'source'>): Promise<ExportResult> {
    return this.exportSongs({
      ...options,
      source: { type: 'liked' }
    })
  }

  async exportPlaylistSongs(
    playlistId: string,
    options: Omit<ExportOptions, 'source'>
  ): Promise<ExportResult> {
    return this.exportSongs({
      ...options,
      source: { type: 'playlist', playlistId }
    })
  }

  async exportCsv(songs: ExportableSong[], filePath: string, exportData: ExportData): Promise<void> {
    const headers = [
      '序号',
      '歌名',
      '歌手',
      '专辑',
      '时长',
      exportData.timeColumnName,
      '网易云歌曲ID',
      '封面链接',
      exportData.sourceType === 'liked' ? '网易云原始顺序' : '歌单原始顺序'
    ]
    const rows = toExportRows(songs, exportData).map((row) => [
      row.index,
      row.name,
      row.artists,
      row.album,
      row.duration,
      row.time,
      row.ncmSongId,
      row.coverUrl,
      row.orderIndex + 1
    ])
    const csvContent = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n')

    await writeFile(filePath, `\uFEFF${csvContent}`, 'utf8')
  }

  async exportJson(
    songs: ExportableSong[],
    filePath: string,
    options: ExportOptions,
    exportData: ExportData
  ): Promise<void> {
    const exportedAt = nowIso()
    const payload = {
      schemaVersion: 1,
      app: 'WaveYourYarn',
      source: {
        type: exportData.sourceType,
        id: exportData.sourceId,
        name: exportData.sourceName
      },
      musicPlatform: 'Netease Cloud Music',
      timeType: exportData.timeType,
      exportedAt,
      format: 'json',
      scope: options.scope,
      sortMode: normalizeSortMode(options.sortMode),
      count: songs.length,
      songs: toExportRows(songs, exportData).map((row) => ({
        index: row.index,
        ncmSongId: row.ncmSongId,
        name: row.name,
        artists: row.artistNames,
        album: row.album,
        durationMs: row.durationMs,
        duration: row.duration,
        time: row.time,
        timeTimestamp: row.timeTimestamp,
        timeType: exportData.timeType,
        coverUrl: row.coverUrl,
        orderIndex: row.orderIndex
      }))
    }

    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
  }

  async exportMarkdown(
    songs: ExportableSong[],
    filePath: string,
    sortMode: ExportSortMode,
    exportData: ExportData
  ): Promise<void> {
    const rows = toExportRows(songs, exportData)
    const title =
      exportData.sourceType === 'liked'
        ? '# WaveYourYarn - 网易云我喜欢的音乐导出'
        : `# WaveYourYarn - 网易云歌单导出：${exportData.sourceName}`
    const lines = [
      title,
      '',
      `导出来源：${exportData.sourceName}  `,
      `导出时间：${formatDateTime(Date.now())}  `,
      `歌曲数量：${songs.length}  `,
      `排序方式：${formatSortMode(sortMode, exportData.sourceType)}  `,
      '',
      `| 序号 | 歌名 | 歌手 | 专辑 | 时长 | ${exportData.timeColumnName} | 网易云 ID |`,
      '|---:|---|---|---|---:|---|---:|',
      ...rows
        .map((row) =>
          [
            row.index,
            escapeMarkdownCell(row.name),
            escapeMarkdownCell(row.artists),
            escapeMarkdownCell(row.album),
            row.duration,
            escapeMarkdownCell(row.time),
            row.ncmSongId
          ].join(' | ')
        )
        .map((row) => `| ${row} |`)
    ]

    await writeFile(filePath, lines.join('\n'), 'utf8')
  }

  async getExportRecords(): Promise<ExportRecord[]> {
    return this.exportRecordRepository.findAll()
  }

  async openExportFile(recordId: string): Promise<void> {
    const record = this.getExportRecordOrThrow(recordId)
    const result = await shell.openPath(record.filePath)

    if (result) {
      throw new Error(result)
    }
  }

  async openExportFolder(recordId: string): Promise<void> {
    const record = this.getExportRecordOrThrow(recordId)
    shell.showItemInFolder(record.filePath)
  }

  async clearExportRecords(): Promise<void> {
    this.exportRecordRepository.clearAll()
  }

  private getExportRecordOrThrow(recordId: string): ExportRecord {
    const record = this.exportRecordRepository.findById(recordId)

    if (!record) {
      throw new Error('导出记录不存在或已被清理')
    }

    return record
  }

  private async getSongsForExport(options: ExportOptions): Promise<ExportData> {
    const source = options.source ?? { type: 'liked' }

    if (source.type === 'liked') {
      return {
        sourceType: 'liked',
        sourceName: '我喜欢的音乐',
        songs: await this.songService.getLikedSongs(),
        timeColumnName: '收藏时间',
        timeType: 'likedAt'
      }
    }

    const playlist = this.playlistRepository.findById(source.playlistId)

    if (!playlist) {
      throw new Error('指定歌单不存在，可能是本地缓存已清空')
    }

    return {
      sourceType: 'playlist',
      sourceId: playlist.id,
      sourceName: playlist.name,
      songs: this.playlistRepository.getPlaylistSongs(playlist.id),
      timeColumnName: '加入歌单时间',
      timeType: 'addedAt'
    }
  }

  private async selectExportFilePath(format: ExportFormat, sourceName: string): Promise<string> {
    const defaultDirectory = await this.settingsService.resolveDefaultExportDirectory(
      app.getPath('downloads')
    )
    const result = await dialog.showSaveDialog({
      title: '导出歌曲',
      defaultPath: join(defaultDirectory, defaultExportFileName(format, sourceName)),
      filters: exportFilters[format]
    })

    if (result.canceled || !result.filePath) {
      throw new ExportCancelledError()
    }

    return result.filePath
  }
}

class ExportCancelledError extends Error {
  constructor() {
    super(EXPORT_CANCELLED_MESSAGE)
    this.name = EXPORT_CANCELLED_CODE
  }
}

const exportFilters: Record<ExportFormat, Electron.FileFilter[]> = {
  csv: [{ name: 'CSV 文件', extensions: ['csv'] }],
  json: [{ name: 'JSON 文件', extensions: ['json'] }],
  markdown: [{ name: 'Markdown 文件', extensions: ['md'] }]
}

function normalizeExportOptions(options: ExportOptions): ExportOptions {
  if (!['csv', 'json', 'markdown'].includes(options.format)) {
    throw new Error('导出格式不支持')
  }

  if (!['all', 'filtered'].includes(options.scope)) {
    throw new Error('导出范围无效')
  }

  if (
    ![
      'timeDesc',
      'timeAsc',
      'originalOrder',
      'likedAtDesc',
      'likedAtAsc',
      'addedAtDesc',
      'addedAtAsc'
    ].includes(options.sortMode)
  ) {
    throw new Error('排序方式无效')
  }

  const source = options.source ?? { type: 'liked' as const }

  if (source.type === 'playlist' && !source.playlistId.trim()) {
    throw new Error('指定歌单不能为空')
  }

  return {
    source,
    format: options.format,
    scope: options.scope,
    keyword: typeof options.keyword === 'string' ? options.keyword.trim() : '',
    sortMode: normalizeSortMode(options.sortMode),
    filePath: typeof options.filePath === 'string' && options.filePath.trim() ? options.filePath : undefined
  }
}

function filterSongs(songs: ExportableSong[], keyword: string): ExportableSong[] {
  const lowerKeyword = keyword.trim().toLowerCase()

  if (!lowerKeyword) {
    return songs
  }

  return songs.filter((song) => {
    return (
      song.name.toLowerCase().includes(lowerKeyword) ||
      song.album?.toLowerCase().includes(lowerKeyword) ||
      song.artists.some((artist) => artist.toLowerCase().includes(lowerKeyword))
    )
  })
}

function sortExportSongs(
  songs: ExportableSong[],
  sourceType: ExportSourceType,
  sortMode: ExportSortMode
): ExportableSong[] {
  const normalizedSortMode = normalizeSortMode(sortMode)

  return [...songs].sort((a, b) => {
    if (normalizedSortMode === 'originalOrder') {
      return a.orderIndex - b.orderIndex
    }

    const aTime = getSongTime(a, sourceType)
    const bTime = getSongTime(b, sourceType)

    if (aTime === null && bTime === null) {
      return a.orderIndex - b.orderIndex
    }

    if (aTime === null) {
      return 1
    }

    if (bTime === null) {
      return -1
    }

    return normalizedSortMode === 'timeDesc' ? bTime - aTime : aTime - bTime
  })
}

function normalizeSortMode(sortMode: ExportSortMode): ExportSortMode {
  if (sortMode === 'likedAtDesc' || sortMode === 'addedAtDesc') {
    return 'timeDesc'
  }

  if (sortMode === 'likedAtAsc' || sortMode === 'addedAtAsc') {
    return 'timeAsc'
  }

  return sortMode
}

function toExportRows(songs: ExportableSong[], exportData: ExportData): ExportSongRow[] {
  return songs.map((song, index) => {
    const timeTimestamp = getSongTime(song, exportData.sourceType) ?? undefined

    return {
      index: index + 1,
      name: song.name,
      artistNames: song.artists,
      artists: song.artists.join(' / '),
      album: song.album ?? '',
      duration: formatDuration(song.duration),
      durationMs: song.duration,
      time: timeTimestamp ? formatDateTime(timeTimestamp) : '',
      timeTimestamp,
      ncmSongId: song.ncmSongId,
      coverUrl: song.coverUrl ?? '',
      orderIndex: song.orderIndex
    }
  })
}

function getSongTime(song: ExportableSong, sourceType: ExportSourceType): number | null {
  if (sourceType === 'liked') {
    return 'likedAt' in song && song.likedAt ? song.likedAt : null
  }

  return 'addedAt' in song && song.addedAt ? song.addedAt : null
}

function escapeCsvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  const escaped = text.replace(/"/g, '""')
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped
}

function escapeMarkdownCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/[\n\r]+/g, ' ')
}

function formatDuration(durationMs?: number): string {
  if (!durationMs) {
    return ''
  }

  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function formatSortMode(sortMode: ExportSortMode, sourceType: ExportSourceType): string {
  const normalizedSortMode = normalizeSortMode(sortMode)

  if (normalizedSortMode === 'originalOrder') {
    return sourceType === 'liked' ? '网易云原始顺序' : '歌单原始顺序'
  }

  if (normalizedSortMode === 'timeDesc') {
    return sourceType === 'liked' ? '收藏时间新到旧' : '加入时间新到旧'
  }

  return sourceType === 'liked' ? '收藏时间旧到新' : '加入时间旧到新'
}

function defaultExportFileName(format: ExportFormat, sourceName: string): string {
  const extension = format === 'markdown' ? 'md' : format
  return `WaveYourYarn-${sanitizeFileName(sourceName)}-${new Date().toISOString().slice(0, 10)}.${extension}`
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || '导出歌曲'
}
