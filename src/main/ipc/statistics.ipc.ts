import { getDatabase } from '../db/database'
import { StatisticsRepository } from '../db/repositories/StatisticsRepository'
import { StatisticsService } from '../services/StatisticsService'
import type { IpcResult } from '../types/common'
import type { StatisticsSource } from '../types/statistics'
import { toIpcResult } from './ipcResult'
import { registerIpcHandler } from './registerIpcHandler'

export function registerStatisticsIpc(): void {
  const statisticsService = new StatisticsService(new StatisticsRepository(getDatabase()))

  registerIpcHandler('statistics:get-summary', async (_event, source: unknown) => {
    const parsedSource = parseStatisticsSource(source)

    if (!parsedSource) {
      return invalidSourceResult()
    }

    return toIpcResult(
      () => statisticsService.getMusicStatsSummary(parsedSource),
      '统计数据生成失败'
    )
  })

  registerIpcHandler('statistics:get-sources', async () =>
    toIpcResult(() => statisticsService.getAvailableStatisticsSources(), '读取统计来源失败')
  )

  registerIpcHandler('statistics:get-analysis-dataset', async (_event, source: unknown) => {
    const parsedSource = parseStatisticsSource(source)

    if (!parsedSource) {
      return invalidSourceResult()
    }

    return toIpcResult(
      () => statisticsService.getAnalysisDataset(parsedSource),
      '分析数据集生成失败'
    )
  })
}

function parseStatisticsSource(source: unknown): StatisticsSource | null {
  if (!source || typeof source !== 'object') {
    return null
  }

  const record = source as Record<string, unknown>

  if (record.type === 'liked') {
    return { type: 'liked' }
  }

  if (record.type === 'all') {
    return { type: 'all' }
  }

  if (
    record.type === 'playlist' &&
    typeof record.playlistId === 'string' &&
    record.playlistId.trim()
  ) {
    return {
      type: 'playlist',
      playlistId: record.playlistId.trim()
    }
  }

  return null
}

function invalidSourceResult(): IpcResult {
  return {
    success: false,
    message: '统计来源无效',
    error: 'INVALID_STATISTICS_SOURCE'
  }
}
