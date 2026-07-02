import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorState } from '../components/common/ErrorState'
import { LoadingState } from '../components/common/LoadingState'
import { PageHeader } from '../components/common/PageHeader'
import { usePlaylistDetailStore, type PlaylistTrackSortMode } from '../stores/playlistDetailStore'
import type { Playlist } from '../types/playlist'
import { formatDuration } from '../utils/format'
import { typeLabel } from './PlaylistsPage'

const sortOptions: Array<{ value: PlaylistTrackSortMode; label: string }> = [
  { value: 'originalOrder', label: '网易云原始顺序' },
  { value: 'addedAtDesc', label: '加入时间新到旧' },
  { value: 'addedAtAsc', label: '加入时间旧到新' }
]

export function PlaylistDetailPage(): JSX.Element {
  const { id } = useParams()
  const {
    playlist,
    tracks,
    filteredTracks,
    loading,
    syncing,
    keyword,
    sortMode,
    error,
    lastSyncResult,
    loadPlaylist,
    loadTracks,
    syncPlaylistSongs,
    searchTracks,
    setKeyword,
    setSortMode,
    clearTracksCache,
    reset
  } = usePlaylistDetailStore()

  useEffect(() => {
    reset()

    if (id) {
      loadPlaylist(id)
      loadTracks(id)
    }

    return () => reset()
  }, [id, loadPlaylist, loadTracks, reset])

  const playlistId = id ?? ''
  const handleKeywordChange = (value: string): void => {
    setKeyword(value)
    if (playlistId) {
      void searchTracks(playlistId, value)
    }
  }

  const clearCache = async (): Promise<void> => {
    const confirmed = window.confirm(
      '这只会清空 WaveYourYarn 本地缓存的该歌单歌曲列表，不会删除网易云上的歌单或歌曲。'
    )

    if (confirmed && playlistId) {
      await clearTracksCache(playlistId)
    }
  }

  return (
    <div>
      <PageHeader title="歌单详情" description="同步并查看该歌单中的歌曲列表" />
      <Link
        to="/playlists"
        className="mb-6 inline-flex rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        返回歌单列表
      </Link>

      {loading && !playlist ? <LoadingState message="正在读取歌单详情..." /> : null}
      {error ? <div className="mb-6"><ErrorState message={error} /></div> : null}
      {!loading && !error && !playlist ? (
        <EmptyState title="歌单不存在" description="歌单不存在或本地缓存已清空。" />
      ) : null}

      {playlist ? (
        <>
          <PlaylistHeader playlist={playlist} />

          <section className="mt-6 rounded-md border bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">本地歌曲缓存</p>
                <p className="mt-1 text-2xl font-semibold">{tracks.length} 首</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void syncPlaylistSongs(playlist.id)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {syncing ? '同步中...' : '同步歌单歌曲'}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void loadTracks(playlist.id)}
                  className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  刷新本地缓存
                </button>
                <Link
                  to={`/export?source=playlist&playlistId=${encodeURIComponent(playlist.id)}`}
                  className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  导出当前歌单
                </Link>
                {playlist.type !== 'liked' ? (
                  <button
                    type="button"
                    disabled={loading || tracks.length === 0}
                    onClick={() => void clearCache()}
                    className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    清空本歌单歌曲缓存
                  </button>
                ) : null}
              </div>
            </div>

            {syncing ? (
              <div className="mt-4">
                <LoadingState message="正在从网易云音乐读取该歌单歌曲，请稍候" />
              </div>
            ) : null}

            {lastSyncResult ? (
              <div className="mt-4 rounded-md bg-muted p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">同步完成</p>
                <p className="mt-1">
                  总数 {lastSyncResult.total}，成功 {lastSyncResult.successCount}，失败{' '}
                  {lastSyncResult.failedCount}，加入时间：
                  {lastSyncResult.hasAddedAt ? '已获取' : '未获取'}，同步时间{' '}
                  {new Date(lastSyncResult.syncedAt).toLocaleString()}
                </p>
                {lastSyncResult.failedCount > 0 ? (
                  <p className="mt-1 text-amber-700">部分歌曲详情获取失败，可稍后重新同步。</p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="mt-6 rounded-md border bg-white">
            <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                歌曲总数 {tracks.length}，当前筛选 {filteredTracks.length}
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as PlaylistTrackSortMode)}
                  className="rounded-md border px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={keyword}
                  onChange={(event) => handleKeywordChange(event.target.value)}
                  placeholder="搜索歌曲、歌手或专辑"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-primary md:w-72"
                />
              </div>
            </div>

            {loading && tracks.length > 0 ? <LoadingState message="正在读取本地歌曲缓存..." /> : null}

            {!loading && tracks.length === 0 ? (
              <div className="p-6">
                <EmptyState title="当前歌单还没有同步歌曲" description="点击同步歌单歌曲后，歌曲会保存到本地缓存。" />
              </div>
            ) : null}

            {!loading && tracks.length > 0 && filteredTracks.length === 0 ? (
              <div className="p-6">
                <EmptyState title="没有匹配的歌曲" description="可以尝试更短的关键词，或清空搜索。" />
              </div>
            ) : null}

            {filteredTracks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">序号</th>
                      <th className="px-4 py-3 font-medium">歌名</th>
                      <th className="px-4 py-3 font-medium">歌手</th>
                      <th className="px-4 py-3 font-medium">专辑</th>
                      <th className="px-4 py-3 font-medium">时长</th>
                      <th className="px-4 py-3 font-medium">加入歌单时间</th>
                      <th className="px-4 py-3 font-medium">网易云 ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredTracks.map((track, index) => (
                      <tr key={`${track.playlistId}-${track.id}`} className="hover:bg-muted/40">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {(track.orderIndex ?? index) + 1}
                        </td>
                        <td className="min-w-48 px-4 py-3 font-medium">{track.name}</td>
                        <td className="min-w-40 px-4 py-3">{track.artists.join(' / ') || '-'}</td>
                        <td className="min-w-48 px-4 py-3 text-muted-foreground">{track.album ?? '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDuration(track.duration)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatTimestamp(track.addedAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{track.ncmSongId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}

function PlaylistHeader({ playlist }: { playlist: Playlist }): JSX.Element {
  return (
    <section className="rounded-md border bg-white p-6">
      <div className="flex flex-col gap-6 md:flex-row">
        {playlist.coverUrl ? (
          <img src={playlist.coverUrl} alt={playlist.name} className="h-40 w-40 rounded-md object-cover" />
        ) : (
          <div className="grid h-40 w-40 place-items-center rounded-md bg-muted text-muted-foreground">
            无封面
          </div>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-semibold">{playlist.name}</h3>
            <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
              {typeLabel(playlist.type)}
            </span>
          </div>
          <dl className="mt-5 grid gap-3 text-sm">
            <InfoRow label="创建者" value={playlist.ownerNickname ?? '未知'} />
            <InfoRow label="歌曲数量" value={`${playlist.trackCount ?? 0} 首`} />
            <InfoRow label="播放次数" value={(playlist.playCount ?? 0).toLocaleString()} />
            <InfoRow label="创建时间" value={formatTimestamp(playlist.createTime)} />
            <InfoRow label="更新时间" value={formatTimestamp(playlist.updateTime)} />
            <InfoRow label="描述" value={playlist.description || '暂无描述'} />
          </dl>
        </div>
      </div>
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="grid gap-2 border-b pb-3 md:grid-cols-[100px_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  )
}

function formatTimestamp(timestamp?: number): string {
  return timestamp ? new Date(timestamp).toLocaleString() : '未知'
}
