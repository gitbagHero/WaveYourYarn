import { create } from 'zustand'
import { playlistsApi } from '../api/playlistsApi'
import type { Playlist, SyncPlaylistSongsResult } from '../types/playlist'
import type { PlaylistTrack } from '../types/song'

export type PlaylistTrackSortMode = 'originalOrder' | 'addedAtDesc' | 'addedAtAsc'

interface PlaylistDetailState {
  playlist: Playlist | null
  tracks: PlaylistTrack[]
  filteredTracks: PlaylistTrack[]
  loading: boolean
  syncing: boolean
  keyword: string
  sortMode: PlaylistTrackSortMode
  error: string | null
  lastSyncResult: SyncPlaylistSongsResult | null
  loadPlaylist: (playlistId: string) => Promise<void>
  loadTracks: (playlistId: string) => Promise<void>
  syncPlaylistSongs: (playlistId: string) => Promise<void>
  searchTracks: (playlistId: string, keyword: string) => Promise<void>
  setKeyword: (keyword: string) => void
  setSortMode: (sortMode: PlaylistTrackSortMode) => void
  clearTracksCache: (playlistId: string) => Promise<void>
  reset: () => void
}

export const usePlaylistDetailStore = create<PlaylistDetailState>((set, get) => ({
  playlist: null,
  tracks: [],
  filteredTracks: [],
  loading: false,
  syncing: false,
  keyword: '',
  sortMode: 'originalOrder',
  error: null,
  lastSyncResult: null,
  loadPlaylist: async (playlistId) => {
    set({ loading: true, error: null })

    try {
      const playlist = await playlistsApi.getPlaylistById(playlistId)
      set({ playlist, loading: false, error: null })
    } catch (error) {
      set({ loading: false, error: toErrorMessage(error) })
    }
  },
  loadTracks: async (playlistId) => {
    set({ loading: true, error: null })

    try {
      const tracks = await playlistsApi.getPlaylistSongs(playlistId)
      const { keyword, sortMode } = get()
      set({
        tracks,
        filteredTracks: sortTracks(filterTracks(tracks, keyword), sortMode),
        loading: false,
        error: null
      })
    } catch (error) {
      set({ loading: false, error: toErrorMessage(error) })
    }
  },
  syncPlaylistSongs: async (playlistId) => {
    if (get().syncing) {
      return
    }

    set({ syncing: true, error: null })

    try {
      const result = await playlistsApi.syncPlaylistSongs(playlistId)
      set({ lastSyncResult: result, syncing: false, error: null })
      await get().loadPlaylist(playlistId)
      await get().loadTracks(playlistId)
    } catch (error) {
      set({ syncing: false, error: toErrorMessage(error) })
    }
  },
  searchTracks: async (playlistId, keyword) => {
    set({ keyword, loading: true, error: null })

    try {
      const tracks = await playlistsApi.searchPlaylistSongs(playlistId, keyword)
      set({
        filteredTracks: sortTracks(tracks, get().sortMode),
        loading: false,
        error: null
      })
    } catch (error) {
      set({ loading: false, error: toErrorMessage(error) })
    }
  },
  setKeyword: (keyword) =>
    set((state) => ({
      keyword,
      filteredTracks: sortTracks(filterTracks(state.tracks, keyword), state.sortMode)
    })),
  setSortMode: (sortMode) =>
    set((state) => ({
      sortMode,
      filteredTracks: sortTracks(state.filteredTracks, sortMode)
    })),
  clearTracksCache: async (playlistId) => {
    set({ loading: true, error: null })

    try {
      await playlistsApi.clearPlaylistSongsCache(playlistId)
      set({ tracks: [], filteredTracks: [], keyword: '', loading: false, error: null, lastSyncResult: null })
    } catch (error) {
      set({ loading: false, error: toErrorMessage(error) })
    }
  },
  reset: () =>
    set({
      playlist: null,
      tracks: [],
      filteredTracks: [],
      loading: false,
      syncing: false,
      keyword: '',
      sortMode: 'originalOrder',
      error: null,
      lastSyncResult: null
    })
}))

function filterTracks(tracks: PlaylistTrack[], keyword: string): PlaylistTrack[] {
  const lowerKeyword = keyword.trim().toLowerCase()

  if (!lowerKeyword) {
    return tracks
  }

  return tracks.filter((track) => {
    return (
      track.name.toLowerCase().includes(lowerKeyword) ||
      track.album?.toLowerCase().includes(lowerKeyword) ||
      track.artists.some((artist) => artist.toLowerCase().includes(lowerKeyword))
    )
  })
}

function sortTracks(tracks: PlaylistTrack[], sortMode: PlaylistTrackSortMode): PlaylistTrack[] {
  return [...tracks].sort((a, b) => {
    if (sortMode === 'originalOrder') {
      return a.orderIndex - b.orderIndex
    }

    const aTime = a.addedAt ?? null
    const bTime = b.addedAt ?? null

    if (aTime === null && bTime === null) {
      return a.orderIndex - b.orderIndex
    }

    if (aTime === null) {
      return 1
    }

    if (bTime === null) {
      return -1
    }

    return sortMode === 'addedAtDesc' ? bTime - aTime : aTime - bTime
  })
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
