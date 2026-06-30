import { create } from 'zustand'

interface AuthState {
  isLoggedIn: boolean
  nickname: string | null
}

export const useAuthStore = create<AuthState>(() => ({
  isLoggedIn: false,
  nickname: null
}))
