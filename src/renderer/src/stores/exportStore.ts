import { create } from 'zustand'
import { exportApi } from '../api/exportApi'
import type { ExportOptions, ExportRecord, ExportResult } from '../types/export'

interface ExportState {
  exporting: boolean
  loadingRecords: boolean
  records: ExportRecord[]
  error: string | null
  lastResult: ExportResult | null
  exportSongs: (options: ExportOptions) => Promise<void>
  exportLikedSongs: (options: ExportOptions) => Promise<void>
  exportPlaylistSongs: (playlistId: string, options: Omit<ExportOptions, 'source'>) => Promise<void>
  loadRecords: () => Promise<void>
  openFile: (filePath: string) => Promise<void>
  openFolder: (filePath: string) => Promise<void>
  clearRecords: () => Promise<void>
}

export const useExportStore = create<ExportState>((set, get) => ({
  exporting: false,
  loadingRecords: false,
  records: [],
  error: null,
  lastResult: null,
  exportSongs: async (options) => {
    if (get().exporting) {
      return
    }

    set({ exporting: true, error: null })

    try {
      const result = await exportApi.exportSongs(options)
      set({ exporting: false, lastResult: result, error: null })
      await get().loadRecords()
    } catch (error) {
      set({
        exporting: false,
        error: toErrorMessage(error)
      })
    }
  },
  exportLikedSongs: async (options) =>
    get().exportSongs({
      ...options,
      source: { type: 'liked' }
    }),
  exportPlaylistSongs: async (playlistId, options) =>
    get().exportSongs({
      ...options,
      source: { type: 'playlist', playlistId }
    }),
  loadRecords: async () => {
    set({ loadingRecords: true, error: null })

    try {
      const records = await exportApi.getExportRecords()
      set({ records, loadingRecords: false, error: null })
    } catch (error) {
      set({
        loadingRecords: false,
        error: toErrorMessage(error)
      })
    }
  },
  openFile: async (filePath) => {
    try {
      await exportApi.openFile(filePath)
    } catch (error) {
      set({ error: toErrorMessage(error) })
    }
  },
  openFolder: async (filePath) => {
    try {
      await exportApi.openFolder(filePath)
    } catch (error) {
      set({ error: toErrorMessage(error) })
    }
  },
  clearRecords: async () => {
    set({ loadingRecords: true, error: null })

    try {
      await exportApi.clearRecords()
      set({ records: [], loadingRecords: false, error: null })
    } catch (error) {
      set({
        loadingRecords: false,
        error: toErrorMessage(error)
      })
    }
  }
}))

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
