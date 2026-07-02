import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorState } from '../components/common/ErrorState'
import { LoadingState } from '../components/common/LoadingState'
import { PageHeader } from '../components/common/PageHeader'
import { useAuthStore } from '../stores/authStore'
import { usePlaylistStore } from '../stores/playlistStore'
import type { Playlist, PlaylistType } from '../types/playlist'

const typeOptions: Array<{ value: PlaylistType | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'liked', label: '我喜欢的音乐' },
  { value: 'created', label: '我创建的歌单' },
  { value: 'subscribed', label: '我收藏的歌单' },
  { value: 'unknown', label: '未知类型' }
]

export function PlaylistsPage(): JSX.Element {
  const { isLoggedIn, checkLoginStatus } = useAuthStore()
  const {
    playlists,
    filteredPlaylists,
    loading,
    syncing,
    syncingAllSongs,
    keyword,
    typeFilter,
    error,
    lastSyncResult,
    lastSyncAllSongsResult,
    loadPlaylists,
    syncUserPlaylists,
    syncAllPlaylistSongs,
    setKeyword,
    setTypeFilter
  } = usePlaylistStore()

  useEffect(() => {
    checkLoginStatus()
    loadPlaylists()
  }, [checkLoginStatus, loadPlaylists])

  return (
    <div>
      <PageHeader title="我的歌单" description="同步并浏览你在网易云音乐中创建和收藏的歌单。" />

      {!isLoggedIn ? (
        <div className="mb-6 rounded-md border bg-white p-6">
          <h3 className="text-lg font-semibold">当前未连接网易云音乐</h3>
          <p className="mt-2 text-sm text-muted-foreground">请先登录后同步歌单。</p>
          <Link
            to="/login"
            className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            前往登录
          </Link>
        </div>
      ) : null}

      <section className="rounded-md border bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">本地歌单缓存</p>
            <p className="mt-1 text-2xl font-semibold">{playlists.length} 个</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!isLoggedIn || syncing}
              onClick={() => void syncUserPlaylists()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncing ? '同步中...' : '同步歌单列表'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadPlaylists()}
              className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              刷新本地缓存
            </button>
            <button
              type="button"
              disabled={!isLoggedIn || syncingAllSongs || playlists.length === 0}
              onClick={() => void syncAllPlaylistSongs()}
              className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncingAllSongs ? '同步中...' : '一键同步所有歌单歌曲'}
            </button>
          </div>
        </div>

        {syncing ? <div className="mt-4"><LoadingState message="正在从网易云音乐读取你的歌单列表" /></div> : null}
        {syncingAllSongs ? (
          <div className="mt-4">
            <LoadingState message="正在逐个同步所有歌单歌曲，歌单较多时需要等待一段时间" />
          </div>
        ) : null}

        {lastSyncResult ? (
          <div className="mt-4 rounded-md bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">同步完成</p>
            <p className="mt-1">
              总数 {lastSyncResult.total}，我喜欢 {lastSyncResult.likedCount}，创建{' '}
              {lastSyncResult.createdCount}，收藏 {lastSyncResult.subscribedCount}，未知{' '}
              {lastSyncResult.unknownCount}，同步时间 {new Date(lastSyncResult.syncedAt).toLocaleString()}
            </p>
          </div>
        ) : null}
        {lastSyncAllSongsResult ? (
          <div className="mt-4 rounded-md bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">所有歌单歌曲同步完成</p>
            <p className="mt-1">
              歌单总数 {lastSyncAllSongsResult.totalPlaylists}，成功{' '}
              {lastSyncAllSongsResult.successPlaylistCount}，失败{' '}
              {lastSyncAllSongsResult.failedPlaylistCount}；歌曲总数{' '}
              {lastSyncAllSongsResult.totalTracks}，成功 {lastSyncAllSongsResult.successTrackCount}，
              失败 {lastSyncAllSongsResult.failedTrackCount}，同步时间{' '}
              {new Date(lastSyncAllSongsResult.syncedAt).toLocaleString()}
            </p>
            {lastSyncAllSongsResult.failedPlaylists.length > 0 ? (
              <p className="mt-1 text-amber-700">
                有 {lastSyncAllSongsResult.failedPlaylists.length} 个歌单同步失败，可稍后单独重试。
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {error ? <div className="mt-6"><ErrorState message={error} /></div> : null}

      <section className="mt-6 rounded-md border bg-white p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索歌单名称、描述或创建者"
            className="rounded-md border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as PlaylistType | 'all')}
            className="rounded-md border px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          歌单总数 {playlists.length}，当前筛选 {filteredPlaylists.length}
        </p>
      </section>

      {loading && !syncing ? <div className="mt-6"><LoadingState message="正在读取本地歌单缓存..." /></div> : null}

      {!loading && playlists.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="还没有同步歌单列表" description="点击同步歌单列表后，歌单会保存到本地缓存。" />
        </div>
      ) : null}

      {!loading && playlists.length > 0 && filteredPlaylists.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="没有找到符合条件的歌单" description="可以调整搜索关键词或类型筛选。" />
        </div>
      ) : null}

      {filteredPlaylists.length > 0 ? (
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPlaylists.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </section>
      ) : null}
    </div>
  )
}

function PlaylistCard({ playlist }: { playlist: Playlist }): JSX.Element {
  return (
    <article className="rounded-md border bg-white p-4">
      <div className="flex gap-4">
        {playlist.coverUrl ? (
          <img src={playlist.coverUrl} alt={playlist.name} className="h-20 w-20 rounded-md object-cover" />
        ) : (
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-md bg-muted text-sm text-muted-foreground">
            无封面
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 font-semibold">{playlist.name}</h3>
            <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
              {typeLabel(playlist.type)}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {playlist.trackCount ?? 0} 首 · {playlist.ownerNickname ?? '未知创建者'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            播放 {formatNumber(playlist.playCount)} · 更新 {formatTimestamp(playlist.updateTime)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/playlists/${playlist.id}`}
          className="inline-flex rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          查看详情
        </Link>
        <Link
          to={`/export?source=playlist&playlistId=${encodeURIComponent(playlist.id)}`}
          className="inline-flex rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          导出
        </Link>
      </div>
    </article>
  )
}

export function typeLabel(type: PlaylistType): string {
  const labels: Record<PlaylistType, string> = {
    liked: '我喜欢',
    created: '我创建',
    subscribed: '我收藏',
    unknown: '未知'
  }

  return labels[type]
}

function formatTimestamp(timestamp?: number): string {
  return timestamp ? new Date(timestamp).toLocaleDateString() : '未知'
}

function formatNumber(value?: number): string {
  return typeof value === 'number' ? value.toLocaleString() : '0'
}
