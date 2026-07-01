import { app, dialog, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { nanoid } from 'nanoid'
import { ExportRecordRepository } from '../db/repositories/ExportRecordRepository'
import type {
  ExportFormat,
  ExportOptions,
  ExportRecord,
  ExportResult,
  ExportSortMode
} from '../types/export'
import type { LikedSong } from '../types/song'
import { logger } from '../utils/logger'
import { nowIso } from '../utils/time'
import { SongService } from './SongService'

const EXPORT_CANCELLED_MESSAGE = '导出已取消'
export const EXPORT_CANCELLED_CODE = 'EXPORT_CANCELLED'

export class ExportService {
  constructor(
    private readonly exportRecordRepository = new ExportRecordRepository(),
    private readonly songService = new SongService()
  ) {}

  getExportRecordCount(): number {
    return this.exportRecordRepository.count()
  }

  async exportLikedSongs(options: ExportOptions): Promise<ExportResult> {
    const normalizedOptions = normalizeExportOptions(options)
    const allSongs = await this.songService.getLikedSongs()
    const filteredSongs =
      normalizedOptions.scope === 'filtered'
        ? filterSongs(allSongs, normalizedOptions.keyword ?? '')
        : allSongs
    const songs = sortSongs(filteredSongs, normalizedOptions.sortMode)

    if (allSongs.length === 0) {
      throw new Error('当前还没有同步歌曲，请先同步“我喜欢的音乐”后再导出')
    }

    if (songs.length === 0) {
      throw new Error('没有匹配到符合条件的歌曲，请调整搜索关键词')
    }

    const filePath = normalizedOptions.filePath ?? (await this.selectExportFilePath(normalizedOptions.format))

    logger.info('开始导出我喜欢的音乐', {
      format: normalizedOptions.format,
      scope: normalizedOptions.scope,
      sortMode: normalizedOptions.sortMode,
      count: songs.length,
      extension: extname(filePath)
    })

    if (normalizedOptions.format === 'csv') {
      await this.exportCsv(songs, filePath)
    } else if (normalizedOptions.format === 'json') {
      await this.exportJson(songs, filePath, normalizedOptions.sortMode)
    } else {
      await this.exportMarkdown(songs, filePath, normalizedOptions.sortMode)
    }

    const exportedAt = nowIso()
    const record: ExportRecord = {
      id: nanoid(),
      exportType: normalizedOptions.format,
      filePath,
      songCount: songs.length,
      scope: normalizedOptions.scope,
      sortMode: normalizedOptions.sortMode,
      createdAt: exportedAt
    }

    try {
      this.exportRecordRepository.create(record)
    } catch (error) {
      logger.warn('导出文件已生成，但导出记录保存失败', error)
      throw new Error(`文件已导出，但记录保存失败：${filePath}`)
    }

    logger.info('导出我喜欢的音乐完成', {
      format: normalizedOptions.format,
      count: songs.length,
      fileName: basename(filePath)
    })

    return {
      id: record.id,
      format: record.exportType,
      filePath: record.filePath,
      songCount: record.songCount,
      exportedAt
    }
  }

  async exportCsv(songs: LikedSong[], filePath: string): Promise<void> {
    const headers = [
      '序号',
      '歌名',
      '歌手',
      '专辑',
      '时长',
      '收藏时间',
      '网易云歌曲ID',
      '封面链接',
      '网易云原始顺序'
    ]
    const rows = toExportRows(songs).map((row) => [
      row.index,
      row.name,
      row.artists,
      row.album,
      row.duration,
      row.likedAt,
      row.ncmSongId,
      row.coverUrl,
      row.orderIndex + 1
    ])
    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(','))
      .join('\n')

    await writeFile(filePath, `\uFEFF${csvContent}`, 'utf8')
  }

  async exportJson(
    songs: LikedSong[],
    filePath: string,
    sortMode: ExportSortMode = 'likedAtDesc'
  ): Promise<void> {
    const exportedAt = nowIso()
    const payload = {
      schemaVersion: 1,
      app: 'WaveYourYarn',
      source: 'Netease Cloud Music',
      playlist: '我喜欢的音乐',
      exportedAt,
      format: 'json',
      sortMode,
      count: songs.length,
      songs: toExportRows(songs).map((row) => ({
        index: row.index,
        ncmSongId: row.ncmSongId,
        name: row.name,
        artists: row.artistNames,
        album: row.album,
        durationMs: row.durationMs,
        duration: row.duration,
        likedAt: row.likedAt,
        likedAtTimestamp: row.likedAtTimestamp,
        coverUrl: row.coverUrl,
        orderIndex: row.orderIndex
      }))
    }

    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
  }

  async exportMarkdown(
    songs: LikedSong[],
    filePath: string,
    sortMode: ExportSortMode = 'likedAtDesc'
  ): Promise<void> {
    const rows = toExportRows(songs)
    const lines = [
      '# WaveYourYarn - 网易云我喜欢的音乐导出',
      '',
      `导出时间：${formatDateTime(Date.now())}  `,
      `歌曲数量：${songs.length}  `,
      `排序方式：${formatSortMode(sortMode)}  `,
      '',
      '| 序号 | 歌名 | 歌手 | 专辑 | 时长 | 收藏时间 | 网易云 ID |',
      '|---:|---|---|---|---:|---|---:|',
      ...rows.map((row) =>
        [
          row.index,
          escapeMarkdownCell(row.name),
          escapeMarkdownCell(row.artists),
          escapeMarkdownCell(row.album),
          row.duration,
          escapeMarkdownCell(row.likedAt),
          row.ncmSongId
        ].join(' | ')
      ).map((row) => `| ${row} |`)
    ]

    await writeFile(filePath, lines.join('\n'), 'utf8')
  }

  async getExportRecords(): Promise<ExportRecord[]> {
    return this.exportRecordRepository.findAll()
  }

  async openExportFile(filePath: string): Promise<void> {
    const result = await shell.openPath(filePath)

    if (result) {
      throw new Error(result)
    }
  }

  async openExportFolder(filePath: string): Promise<void> {
    shell.showItemInFolder(filePath)
  }

  async clearExportRecords(): Promise<void> {
    this.exportRecordRepository.clearAll()
  }

  private async selectExportFilePath(format: ExportFormat): Promise<string> {
    const result = await dialog.showSaveDialog({
      title: '导出我喜欢的音乐',
      defaultPath: join(app.getPath('downloads'), defaultExportFileName(format)),
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

interface ExportSongRow {
  index: number
  name: string
  artistNames: string[]
  artists: string
  album: string
  duration: string
  durationMs?: number
  likedAt: string
  likedAtTimestamp?: number
  ncmSongId: string
  coverUrl: string
  orderIndex: number
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

  if (!['likedAtDesc', 'likedAtAsc', 'originalOrder'].includes(options.sortMode)) {
    throw new Error('排序方式无效')
  }

  return {
    format: options.format,
    scope: options.scope,
    keyword: typeof options.keyword === 'string' ? options.keyword.trim() : '',
    sortMode: options.sortMode,
    filePath: typeof options.filePath === 'string' && options.filePath.trim() ? options.filePath : undefined
  }
}

function filterSongs(songs: LikedSong[], keyword: string): LikedSong[] {
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

function sortSongs(songs: LikedSong[], sortMode: ExportSortMode): LikedSong[] {
  return [...songs].sort((a, b) => {
    if (sortMode === 'originalOrder') {
      return a.orderIndex - b.orderIndex
    }

    const aTime = a.likedAt ?? null
    const bTime = b.likedAt ?? null

    if (aTime === null && bTime === null) {
      return a.orderIndex - b.orderIndex
    }

    if (aTime === null) {
      return 1
    }

    if (bTime === null) {
      return -1
    }

    return sortMode === 'likedAtDesc' ? bTime - aTime : aTime - bTime
  })
}

function toExportRows(songs: LikedSong[]): ExportSongRow[] {
  return songs.map((song, index) => ({
    index: index + 1,
    name: song.name,
    artistNames: song.artists,
    artists: song.artists.join(' / '),
    album: song.album ?? '',
    duration: formatDuration(song.duration),
    durationMs: song.duration,
    likedAt: song.likedAt ? formatDateTime(song.likedAt) : '',
    likedAtTimestamp: song.likedAt,
    ncmSongId: song.ncmSongId,
    coverUrl: song.coverUrl ?? '',
    orderIndex: song.orderIndex
  }))
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

function formatSortMode(sortMode: ExportSortMode): string {
  const labels: Record<ExportSortMode, string> = {
    likedAtDesc: '收藏时间新到旧',
    likedAtAsc: '收藏时间旧到新',
    originalOrder: '网易云原始顺序'
  }

  return labels[sortMode]
}

function defaultExportFileName(format: ExportFormat): string {
  const extension = format === 'markdown' ? 'md' : format
  return `WaveYourYarn-我喜欢的音乐-${new Date().toISOString().slice(0, 10)}.${extension}`
}
