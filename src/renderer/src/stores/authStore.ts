import { create } from 'zustand'
import { authApi } from '../api/authApi'
import type { UserProfile } from '../types/user'
import { useExportStore } from './exportStore'
import { usePlaylistDetailStore } from './playlistDetailStore'
import { usePlaylistStore } from './playlistStore'
import { useSongStore } from './songStore'
import { useStatisticsStore } from './statisticsStore'

interface AuthState {
  isLoggedIn: boolean
  user: UserProfile | null
  loading: boolean
  error: string | null
  notice: string | null
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
  notice: null,
  checkLoginStatus: async () => {
    set({ loading: true, error: null })
    const result = await authApi.getLoginStatus()

    if (result.success) {
      if (result.data?.cacheReset) {
        resetAccountScopedStores()
      }

      set({
        isLoggedIn: Boolean(result.data?.isLoggedIn),
        user: result.data?.user ?? null,
        loading: false,
        error: null,
        notice: result.data?.cacheReset ? accountSwitchNotice : null
      })
      return
    }

    set({
      isLoggedIn: false,
      user: null,
      loading: false,
      error: result.message ?? '登录状态检查失败',
      notice: null
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
      if (result.data.cacheReset) {
        resetAccountScopedStores()
      }

      set({
        isLoggedIn: true,
        user: result.data.user,
        loading: false,
        error: null,
        notice: result.data.cacheReset ? accountSwitchNotice : null
      })
      return
    }

    set({
      isLoggedIn: false,
      user: null,
      loading: false,
      error: result.message ?? '网页登录失败，请重试',
      notice: null
    })
  },
  loginWithCookie: async (cookie) => {
    set({ loading: true, error: null })
    const result = await authApi.loginWithCookie(cookie)

    if (result.success && result.data?.isLoggedIn && result.data.user) {
      if (result.data.cacheReset) {
        resetAccountScopedStores()
      }

      set({
        isLoggedIn: true,
        user: result.data.user,
        loading: false,
        error: null,
        notice: result.data.cacheReset ? accountSwitchNotice : null
      })
      return
    }

    set({
      isLoggedIn: false,
      user: null,
      loading: false,
      error: result.message ?? 'Cookie 无效或已过期，请重新获取',
      notice: null
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
        error: null,
        notice: null
      })
      return
    }

    set({
      loading: false,
      error: result.message ?? '退出登录失败'
    })
  }
}))

const accountSwitchNotice = '检测到网易云账号切换，旧账号的本地缓存和导出历史已清理。'

function resetAccountScopedStores(): void {
  useSongStore.getState().reset()
  usePlaylistStore.getState().reset()
  usePlaylistDetailStore.getState().reset()
  useStatisticsStore.getState().reset()
  useExportStore.getState().reset()
}
