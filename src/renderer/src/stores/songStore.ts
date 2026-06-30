import { create } from 'zustand'
import type { Song } from '../types/song'

interface SongState {
  likedSongs: Song[]
  keyword: string
  setKeyword: (keyword: string) => void
}

export const useSongStore = create<SongState>((set) => ({
  likedSongs: [],
  keyword: '',
  setKeyword: (keyword) => set({ keyword })
}))
