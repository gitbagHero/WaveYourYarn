import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorState } from '../components/common/ErrorState'
import { LoadingState } from '../components/common/LoadingState'
import { useAuthStore } from '../stores/authStore'
import { useSongStore } from '../stores/songStore'
import { formatDuration } from '../utils/format'

export function LikedSongsPage(): JSX.Element {
  const { isLoggedIn, checkLoginStatus } = useAuthStore()
  const {
    likedSongs,
    filteredSongs,
    loading,
    syncing,
    keyword,
    sortMode,
    error,
    lastSyncResult,
    loadLikedSongs,
    syncLikedSongs,
    searchLikedSongs,
    setKeyword,
    setSortMode
  } = useSongStore()

  useEffect(() => {
    checkLoginStatus()
    loadLikedSongs()
  }, [checkLoginStatus, loadLikedSongs])

  const handleKeywordChange = (value: string): void => {
    setKeyword(value)
    void searchLikedSongs(value)
  }
  const hasAnyLikedAt = likedSongs.some((song) => song.likedAt)

  return (
    <div>
      <PageHeader title="我喜欢的音乐" description="同步并查看你在网易云音乐中喜欢的歌曲" />

      {!isLoggedIn ? (
        <div className="mb-6 rounded-md border bg-white p-6">
          <h3 className="text-lg font-semibold">当前未连接网易云音乐</h3>
          <p className="mt-2 text-sm text-muted-foreground">请先登录后同步“我喜欢的音乐”。</p>
          <Link
            to="/login"
            className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            前往登录
          </Link>
        </div>
      ) : null}

      <section className="mb-6 rounded-md border bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">本地缓存歌曲数</p>
            <p className="mt-1 text-2xl font-semibold">{likedSongs.length}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!isLoggedIn || syncing}
              onClick={() => void syncLikedSongs()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncing ? '同步中...' : '同步我喜欢的音乐'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadLikedSongs()}
              className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              刷新本地缓存
            </button>
            <Link
              to="/export"
              className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              前往导出
            </Link>
          </div>
        </div>

        {syncing ? (
          <div className="mt-4">
            <LoadingState message="正在从网易云音乐读取歌曲数据，请稍候" />
          </div>
        ) : null}

        {lastSyncResult ? (
          <div className="mt-4 rounded-md bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">同步完成</p>
            <p className="mt-1">
              总数 {lastSyncResult.total}，成功 {lastSyncResult.successCount}，失败{' '}
              {lastSyncResult.failedCount}，同步时间 {formatDateTime(lastSyncResult.syncedAt)}
            </p>
            <p className="mt-1">
              数据来源：
              {lastSyncResult.source === 'playlist_detail'
                ? '网易云歌单详情'
                : '无序喜欢列表 fallback'}
              ，收藏时间：
              {lastSyncResult.hasLikedAt ? '已获取' : '未获取'}
            </p>
            {lastSyncResult.failedCount > 0 ? (
              <p className="mt-1 text-amber-700">部分歌曲同步失败，可稍后重试。</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {error ? <div className="mb-6"><ErrorState message={error} /></div> : null}

      <section className="rounded-md border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            歌曲总数 {likedSongs.length}，当前筛选 {filteredSongs.length}
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <select
              value={sortMode}
              onChange={(event) =>
                setSortMode(event.target.value as 'newest' | 'oldest' | 'original')
              }
              className="rounded-md border px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="newest">按收藏时间从新到旧</option>
              <option value="oldest">按收藏时间从旧到新</option>
              <option value="original">按网易云原始顺序</option>
            </select>
            <input
              value={keyword}
              onChange={(event) => handleKeywordChange(event.target.value)}
              placeholder="搜索歌曲、歌手或专辑"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-primary md:w-72"
            />
          </div>
        </div>

        {likedSongs.length > 0 && !hasAnyLikedAt ? (
          <div className="border-b bg-amber-50 px-4 py-3 text-sm text-amber-800">
            当前接口未返回收藏时间，已按网易云歌单索引顺序展示。
          </div>
        ) : null}

        {lastSyncResult?.source === 'likelist_fallback' ? (
          <div className="border-b bg-amber-50 px-4 py-3 text-sm text-amber-800">
            当前未能获取网易云收藏时间，歌曲顺序可能与网易云客户端不一致。
          </div>
        ) : null}

        {loading && !syncing ? <LoadingState message="正在读取本地歌曲缓存..." /> : null}

        {!loading && likedSongs.length === 0 ? (
          <div className="p-6">
            <EmptyState title="还没有同步“我喜欢的音乐”" description="点击同步按钮后，歌曲会保存到本地缓存。" />
          </div>
        ) : null}

        {!loading && likedSongs.length > 0 && filteredSongs.length === 0 ? (
          <div className="p-6">
            <EmptyState title="没有匹配的歌曲" description="可以尝试更短的关键词，或清空搜索。" />
          </div>
        ) : null}

        {filteredSongs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">序号</th>
                  <th className="px-4 py-3 font-medium">歌名</th>
                  <th className="px-4 py-3 font-medium">歌手</th>
                  <th className="px-4 py-3 font-medium">专辑</th>
                  <th className="px-4 py-3 font-medium">时长</th>
                  <th className="px-4 py-3 font-medium">收藏时间</th>
                  <th className="px-4 py-3 font-medium">网易云 ID</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSongs.map((song, index) => (
                  <tr key={song.id} className="hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {(song.orderIndex ?? index) + 1}
                    </td>
                    <td className="min-w-48 px-4 py-3 font-medium">{song.name}</td>
                    <td className="min-w-40 px-4 py-3">{song.artists.join(' / ') || '-'}</td>
                    <td className="min-w-48 px-4 py-3 text-muted-foreground">{song.album ?? '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDuration(song.duration)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatTimestamp(song.likedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{song.ncmSongId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

function formatTimestamp(timestamp?: number): string {
  return timestamp ? new Date(timestamp).toLocaleString() : '未知'
}
