import type { IpcResult } from '../../../main/types/common'
import { getPreloadApi } from './preloadClient'
import type {
  MusicAnalysisDataset,
  MusicStatsSummary,
  StatisticsSource,
  StatisticsSourceInfo
} from '../types/statistics'

export const statisticsApi = {
  getSummary: async (source: StatisticsSource) =>
    unwrap(await getPreloadApi().statistics.getSummary(source)),
  getSources: async () => unwrap(await getPreloadApi().statistics.getSources()),
  getAnalysisDataset: async (source: StatisticsSource) =>
    unwrap(await getPreloadApi().statistics.getAnalysisDataset(source))
}

function unwrap<T>(result: IpcResult<T>): T {
  if (result.success) {
    return result.data as T
  }

  throw new Error(result.message ?? result.error ?? '统计操作失败')
}

export type { MusicAnalysisDataset, MusicStatsSummary, StatisticsSource, StatisticsSourceInfo }
