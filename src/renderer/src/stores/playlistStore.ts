import { create } from 'zustand'
import { playlistsApi } from '../api/playlistsApi'
import type { Playlist, PlaylistType, SyncAllPlaylistSongsResult, SyncPlaylistsResult } from '../types/playlist'

type PlaylistTypeFilter = PlaylistType | 'all'

interface PlaylistState {
  playlists: Playlist[]
  filteredPlaylists: Playlist[]
  loading: boolean
  syncing: boolean
  syncingAllSongs: boolean
  keyword: string
  typeFilter: PlaylistTypeFilter
  error: string | null
  lastSyncResult: SyncPlaylistsResult | null
  lastSyncAllSongsResult: SyncAllPlaylistSongsResult | null
  loadPlaylists: () => Promise<void>
  syncUserPlaylists: () => Promise<void>
  syncAllPlaylistSongs: () => Promise<void>
  searchPlaylists: (keyword: string) => Promise<void>
  setKeyword: (keyword: string) => void
  setTypeFilter: (type: PlaylistTypeFilter) => void
  clearCache: () => Promise<void>
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  filteredPlaylists: [],
  loading: false,
  syncing: false,
  syncingAllSongs: false,
  keyword: '',
  typeFilter: 'all',
  error: null,
  lastSyncResult: null,
  lastSyncAllSongsResult: null,
  loadPlaylists: async () => {
    set({ loading: true, error: null })

    try {
      const playlists = await playlistsApi.getPlaylists()
      const { keyword, typeFilter } = get()
      set({
        playlists,
        filteredPlaylists: applyFilters(playlists, keyword, typeFilter),
        loading: false,
        error: null
      })
    } catch (error) {
      set({ loading: false, error: toErrorMessage(error) })
    }
  },
  syncUserPlaylists: async () => {
    if (get().syncing) {
      return
    }

    set({ syncing: true, error: null })

    try {
      const result = await playlistsApi.syncUserPlaylists()
      set({ syncing: false, lastSyncResult: result, error: null })
      await get().loadPlaylists()
    } catch (error) {
      set({ syncing: false, error: toErrorMessage(error) })
    }
  },
  syncAllPlaylistSongs: async () => {
    if (get().syncingAllSongs) {
      return
    }

    set({ syncingAllSongs: true, error: null })

    try {
      const result = await playlistsApi.syncAllPlaylistSongs()
      set({ syncingAllSongs: false, lastSyncAllSongsResult: result, error: null })
    } catch (error) {
      set({ syncingAllSongs: false, error: toErrorMessage(error) })
    }
  },
  searchPlaylists: async (keyword) => {
    set((state) => ({
      keyword,
      filteredPlaylists: applyFilters(state.playlists, keyword, state.typeFilter)
    }))
  },
  setKeyword: (keyword) =>
    set((state) => ({
      keyword,
      filteredPlaylists: applyFilters(state.playlists, keyword, state.typeFilter)
    })),
  setTypeFilter: (typeFilter) =>
    set((state) => ({
      typeFilter,
      filteredPlaylists: applyFilters(state.playlists, state.keyword, typeFilter)
    })),
  clearCache: async () => {
    set({ loading: true, error: null })

    try {
      await playlistsApi.clearPlaylistCache()
      const playlists = await playlistsApi.getPlaylists()
      const { keyword, typeFilter } = get()
      set({
        playlists,
        filteredPlaylists: applyFilters(playlists, keyword, typeFilter),
        loading: false,
        error: null,
        lastSyncResult: null,
        lastSyncAllSongsResult: null
      })
    } catch (error) {
      set({ loading: false, error: toErrorMessage(error) })
    }
  }
}))

function applyFilters(playlists: Playlist[], keyword: string, typeFilter: PlaylistTypeFilter): Playlist[] {
  const lowerKeyword = keyword.trim().toLowerCase()

  return playlists.filter((playlist) => {
    const matchesType = typeFilter === 'all' || playlist.type === typeFilter
    const matchesKeyword =
      !lowerKeyword ||
      playlist.name.toLowerCase().includes(lowerKeyword) ||
      playlist.description?.toLowerCase().includes(lowerKeyword) ||
      playlist.ownerNickname?.toLowerCase().includes(lowerKeyword)

    return matchesType && matchesKeyword
  })
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
