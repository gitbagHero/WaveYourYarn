import { create } from 'zustand'
import { statisticsApi } from '../api/statisticsApi'
import type { MusicStatsSummary, StatisticsSource, StatisticsSourceInfo } from '../types/statistics'

interface StatisticsState {
  sources: StatisticsSourceInfo[]
  selectedSource: StatisticsSource | null
  summary: MusicStatsSummary | null
  loadingSources: boolean
  loadingSummary: boolean
  error: string | null
  loadSources: () => Promise<void>
  setSelectedSource: (source: StatisticsSource) => void
  loadSummary: (source?: StatisticsSource) => Promise<void>
  reset: () => void
}

const initialState = {
  sources: [],
  selectedSource: null,
  summary: null,
  loadingSources: false,
  loadingSummary: false,
  error: null
}

export const useStatisticsStore = create<StatisticsState>((set, get) => ({
  ...initialState,
  loadSources: async () => {
    set({ loadingSources: true, error: null })

    try {
      const sources = await statisticsApi.getSources()
      const preferredSource = sources.find((source) => source.type === 'liked') ?? sources[0]
      const selectedSource = get().selectedSource ?? toStatisticsSource(preferredSource)

      set({
        sources,
        selectedSource,
        loadingSources: false,
        error: null
      })

      if (selectedSource) {
        await get().loadSummary(selectedSource)
      }
    } catch (error) {
      set({
        loadingSources: false,
        error: toErrorMessage(error)
      })
    }
  },
  setSelectedSource: (source) => {
    set({ selectedSource: source })
  },
  loadSummary: async (source) => {
    const targetSource = source ?? get().selectedSource

    if (!targetSource) {
      set({ summary: null })
      return
    }

    set({ loadingSummary: true, error: null })

    try {
      const summary = await statisticsApi.getSummary(targetSource)
      set({
        selectedSource: targetSource,
        summary,
        loadingSummary: false,
        error: null
      })
    } catch (error) {
      set({
        summary: null,
        loadingSummary: false,
        error: toErrorMessage(error)
      })
    }
  },
  reset: () => set(initialState)
}))

export function toStatisticsSource(source?: StatisticsSourceInfo | null): StatisticsSource | null {
  if (!source) {
    return null
  }

  if (source.type === 'playlist') {
    return source.id ? { type: 'playlist', playlistId: source.id } : null
  }

  return { type: source.type }
}

export function sourceKey(source: StatisticsSource): string {
  return source.type === 'playlist' ? `playlist:${source.playlistId}` : source.type
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
