import { create } from 'zustand'
import { songsApi } from '../api/songsApi'
import type { LikedSong, SyncLikedSongsResult } from '../types/song'

export type LikedSongsSortMode = 'newest' | 'oldest' | 'original'

interface SongState {
  likedSongs: LikedSong[]
  filteredSongs: LikedSong[]
  loading: boolean
  syncing: boolean
  keyword: string
  sortMode: LikedSongsSortMode
  error: string | null
  lastSyncResult: SyncLikedSongsResult | null
  loadLikedSongs: () => Promise<void>
  syncLikedSongs: () => Promise<void>
  searchLikedSongs: (keyword: string) => Promise<void>
  setKeyword: (keyword: string) => void
  setSortMode: (sortMode: LikedSongsSortMode) => void
  clearCache: () => Promise<boolean>
  reset: () => void
}

export const useSongStore = create<SongState>((set, get) => ({
  likedSongs: [],
  filteredSongs: [],
  loading: false,
  syncing: false,
  keyword: '',
  sortMode: 'newest',
  error: null,
  lastSyncResult: null,
  loadLikedSongs: async () => {
    set({ loading: true, error: null })

    try {
      const songs = await songsApi.getLikedSongs()
      const keyword = get().keyword.trim()
      const sortMode = get().sortMode
      set({
        likedSongs: songs,
        filteredSongs: sortSongs(keyword ? filterSongs(songs, keyword) : songs, sortMode),
        loading: false,
        error: null
      })
    } catch (error) {
      set({
        loading: false,
        error: toErrorMessage(error)
      })
    }
  },
  syncLikedSongs: async () => {
    if (get().syncing) {
      return
    }

    set({ syncing: true, error: null })

    try {
      const result = await songsApi.syncLikedSongs()
      set({ lastSyncResult: result, syncing: false, error: null })
      await get().loadLikedSongs()
    } catch (error) {
      set({
        syncing: false,
        error: toErrorMessage(error)
      })
    }
  },
  searchLikedSongs: async (keyword) => {
    const normalizedKeyword = keyword.trim()
    set({ keyword, loading: true, error: null })

    try {
      const songs = await songsApi.searchLikedSongs(normalizedKeyword)
      set({
        filteredSongs: sortSongs(songs, get().sortMode),
        loading: false,
        error: null
      })
    } catch (error) {
      set({
        loading: false,
        error: toErrorMessage(error)
      })
    }
  },
  setKeyword: (keyword) =>
    set((state) => ({
      keyword,
      filteredSongs: sortSongs(
        keyword.trim() ? filterSongs(state.likedSongs, keyword.trim()) : state.likedSongs,
        state.sortMode
      )
    })),
  setSortMode: (sortMode) =>
    set((state) => ({
      sortMode,
      filteredSongs: sortSongs(state.filteredSongs, sortMode)
    })),
  clearCache: async () => {
    set({ loading: true, error: null })

    try {
      await songsApi.clearLikedSongsCache()
      set({
        likedSongs: [],
        filteredSongs: [],
        keyword: '',
        loading: false,
        error: null,
        lastSyncResult: null
      })
      return true
    } catch (error) {
      set({
        loading: false,
        error: toErrorMessage(error)
      })
      return false
    }
  },
  reset: () =>
    set({
      likedSongs: [],
      filteredSongs: [],
      loading: false,
      syncing: false,
      keyword: '',
      sortMode: 'newest',
      error: null,
      lastSyncResult: null
    })
}))

function filterSongs(songs: LikedSong[], keyword: string): LikedSong[] {
  const lowerKeyword = keyword.toLowerCase()

  return songs.filter((song) => {
    return (
      song.name.toLowerCase().includes(lowerKeyword) ||
      song.album?.toLowerCase().includes(lowerKeyword) ||
      song.artists.some((artist) => artist.toLowerCase().includes(lowerKeyword))
    )
  })
}

function sortSongs(songs: LikedSong[], sortMode: LikedSongsSortMode): LikedSong[] {
  return [...songs].sort((a, b) => {
    if (sortMode === 'original') {
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

    return sortMode === 'newest' ? bTime - aTime : aTime - bTime
  })
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
