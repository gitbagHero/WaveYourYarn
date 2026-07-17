import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/authApi'
import { PageHeader } from '../components/common/PageHeader'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import { useExportStore } from '../stores/exportStore'
import { usePlaylistStore } from '../stores/playlistStore'
import { useSongStore } from '../stores/songStore'
import { settingsApi } from '../api/settingsApi'

export function SettingsPage(): JSX.Element {
  const version = useAppStore((state) => state.version)
  const { isLoggedIn, user, loading, error, logout } = useAuthStore()
  const { likedSongs, loading: songsLoading, error: songsError, loadLikedSongs, clearCache } = useSongStore()
  const {
    playlists,
    loading: playlistsLoading,
    error: playlistsError,
    loadPlaylists,
    clearCache: clearPlaylistCache
  } = usePlaylistStore()
  const {
    records,
    loadingRecords,
    error: exportError,
    loadRecords,
    clearRecords
  } = useExportStore()
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)
  const [cacheMessage, setCacheMessage] = useState<string | null>(null)
  const [exportDirectory, setExportDirectory] = useState<string | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)

  useEffect(() => {
    loadLikedSongs()
    loadPlaylists()
    loadRecords()
    setSettingsLoading(true)
    settingsApi.getAll().then((result) => {
      if (result.success) {
        setExportDirectory(result.data?.default_export_directory ?? null)
        setSettingsMessage(null)
      } else {
        setSettingsMessage(result.message ?? '读取设置失败')
      }
      setSettingsLoading(false)
    })
  }, [loadLikedSongs, loadPlaylists, loadRecords])

  const selectExportDirectory = async (): Promise<void> => {
    setSettingsLoading(true)
    setSettingsMessage(null)
    const result = await settingsApi.selectExportDirectory()

    if (result.success) {
      setExportDirectory(result.data ?? null)
      setSettingsMessage(result.data ? '默认导出目录已更新' : null)
    } else {
      setSettingsMessage(result.message ?? '选择默认导出目录失败')
    }
    setSettingsLoading(false)
  }

  const resetExportDirectory = async (): Promise<void> => {
    setSettingsLoading(true)
    setSettingsMessage(null)
    const result = await settingsApi.resetExportDirectory()

    if (result.success) {
      setExportDirectory(null)
      setSettingsMessage('已恢复使用系统 Downloads 目录')
    } else {
      setSettingsMessage(result.message ?? '恢复默认导出目录失败')
    }
    setSettingsLoading(false)
  }

  const clearWebLoginSession = async (): Promise<void> => {
    setSessionMessage(null)
    const result = await authApi.clearWebLoginSession()
    setSessionMessage(result.success ? '网页登录 Session 已清理' : result.message ?? '清理失败')
  }

  const clearLikedSongsCache = async (): Promise<void> => {
    const confirmed = window.confirm('确认清空“我喜欢的音乐”本地缓存吗？此操作不会退出登录。')

    if (!confirmed) {
      return
    }

    setCacheMessage(null)
    const cleared = await clearCache()

    if (cleared) {
      setCacheMessage('“我喜欢的音乐”本地缓存已清空，其他歌单缓存保持不变')
    }
  }

  const clearExportRecords = async (): Promise<void> => {
    const confirmed = window.confirm('确认清空导出历史吗？这不会删除实际导出的文件。')

    if (!confirmed) {
      return
    }

    await clearRecords()
  }

  const clearPlaylistsCache = async (): Promise<void> => {
    const confirmed = window.confirm(
      '确认清空歌单缓存吗？这不会删除你的网易云歌单，也不会清空“我喜欢的音乐”歌曲缓存。'
    )

    if (!confirmed) {
      return
    }

    await clearPlaylistCache()
  }

  return (
    <div>
      <PageHeader title="设置" description="管理登录状态、本地缓存、导出路径和应用信息。" />
      <div className="rounded-md border bg-white p-6">
        <dl className="grid gap-4 text-sm">
          <div className="flex justify-between border-b pb-3">
            <dt className="text-muted-foreground">应用版本</dt>
            <dd className="font-medium">v{version ?? '-'}</dd>
          </div>
          <div className="flex justify-between border-b pb-3">
            <dt className="text-muted-foreground">网易云登录状态</dt>
            <dd className="font-medium">{isLoggedIn ? '已连接' : '未连接'}</dd>
          </div>
          <div className="flex justify-between border-b pb-3">
            <dt className="text-muted-foreground">当前用户</dt>
            <dd className="flex items-center gap-2 font-medium">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.nickname} className="h-6 w-6 rounded-full" />
              ) : null}
              {user?.nickname ?? '-'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">本地缓存</dt>
            <dd className="font-medium">
              {songsLoading ? '读取中...' : `我喜欢的音乐 ${likedSongs.length} 首`}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">导出历史</dt>
            <dd className="font-medium">
              {loadingRecords ? '读取中...' : `${records.length} 条`}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">歌单缓存</dt>
            <dd className="font-medium">
              {playlistsLoading ? '读取中...' : `${playlists.length} 个`}
            </dd>
          </div>
          <div className="flex justify-between gap-6 border-t pt-3">
            <dt className="text-muted-foreground">默认导出目录</dt>
            <dd className="max-w-xl break-all text-right font-medium">
              {settingsLoading ? '读取中...' : exportDirectory ?? '系统 Downloads 目录'}
            </dd>
          </div>
        </dl>

        {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {songsError ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{songsError}</p> : null}
        {exportError ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{exportError}</p> : null}
        {playlistsError ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{playlistsError}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {isLoggedIn ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void logout()}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '正在退出...' : '退出登录'}
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              重新登录
            </Link>
          )}
          <button
            type="button"
            onClick={() => void clearWebLoginSession()}
            className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            清理网页登录 Session
          </button>
          <button
            type="button"
            disabled={songsLoading || likedSongs.length === 0}
            onClick={() => void clearLikedSongsCache()}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            清空“我喜欢的音乐”缓存
          </button>
          <button
            type="button"
            disabled={loadingRecords || records.length === 0}
            onClick={() => void clearExportRecords()}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            清空导出历史
          </button>
          <button
            type="button"
            disabled={playlistsLoading || playlists.filter((playlist) => playlist.type !== 'liked').length === 0}
            onClick={() => void clearPlaylistsCache()}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            清空歌单缓存
          </button>
          <button
            type="button"
            disabled={settingsLoading}
            onClick={() => void selectExportDirectory()}
            className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            选择默认导出目录
          </button>
          <button
            type="button"
            disabled={settingsLoading || !exportDirectory}
            onClick={() => void resetExportDirectory()}
            className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            恢复系统默认目录
          </button>
        </div>
        {sessionMessage ? <p className="mt-3 text-sm text-muted-foreground">{sessionMessage}</p> : null}
        {cacheMessage ? <p className="mt-3 text-sm text-muted-foreground">{cacheMessage}</p> : null}
        {settingsMessage ? (
          <p className="mt-3 text-sm text-muted-foreground">{settingsMessage}</p>
        ) : null}
      </div>
    </div>
  )
}
