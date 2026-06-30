import { create } from 'zustand'
import { authApi } from '../api/authApi'
import type { UserProfile } from '../types/user'

interface AuthState {
  isLoggedIn: boolean
  user: UserProfile | null
  loading: boolean
  error: string | null
  checkLoginStatus: () => Promise<void>
  setUser: (user: UserProfile | null) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  user: null,
  loading: false,
  error: null,
  checkLoginStatus: async () => {
    set({ loading: true, error: null })
    const result = await authApi.getLoginStatus()

    if (result.success) {
      set({
        isLoggedIn: Boolean(result.data?.isLoggedIn),
        user: result.data?.user ?? null,
        loading: false,
        error: null
      })
      return
    }

    set({
      isLoggedIn: false,
      user: null,
      loading: false,
      error: result.message ?? '登录状态检查失败'
    })
  },
  setUser: (user) =>
    set({
      user,
      isLoggedIn: Boolean(user),
      error: null
    }),
  logout: async () => {
    set({ loading: true, error: null })
    const result = await authApi.logout()

    if (result.success) {
      set({
        isLoggedIn: false,
        user: null,
        loading: false,
        error: null
      })
      return
    }

    set({
      loading: false,
      error: result.message ?? '退出登录失败'
    })
  }
}))
