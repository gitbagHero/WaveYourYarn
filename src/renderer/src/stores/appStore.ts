import { create } from 'zustand'
import { appApi } from '../api/appApi'

interface AppState {
  version: string | null
  loadVersion: () => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  version: null,
  loadVersion: async () => {
    const result = await appApi.getVersion()
    if (result.success && result.data) {
      set({ version: result.data })
    }
  }
}))
