import { create } from 'zustand'
import { authApi } from '../api/authApi'
import type { UserProfile } from '../types/user'

interface AuthState {
  isLoggedIn: boolean
  user: UserProfile | null
  loading: boolean
  error: string | null
  checkLoginStatus: () => Promise<void>
  openWebLogin: () => Promise<void>
  loginWithCookie: (cookie: string) => Promise<void>
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
  openWebLogin: async () => {
    set({ loading: true, error: null })
    const result = await authApi.openWebLogin()

    if (result.success && result.data?.isLoggedIn && result.data.user) {
      set({
        isLoggedIn: true,
        user: result.data.user,
        loading: false,
        error: null
      })
      return
    }

    set({
      isLoggedIn: false,
      user: null,
      loading: false,
      error: result.message ?? '网页登录失败，请重试'
    })
  },
  loginWithCookie: async (cookie) => {
    set({ loading: true, error: null })
    const result = await authApi.loginWithCookie(cookie)

    if (result.success && result.data?.isLoggedIn && result.data.user) {
      set({
        isLoggedIn: true,
        user: result.data.user,
        loading: false,
        error: null
      })
      return
    }

    set({
      isLoggedIn: false,
      user: null,
      loading: false,
      error: result.message ?? 'Cookie 无效或已过期，请重新获取'
    })
  },
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
