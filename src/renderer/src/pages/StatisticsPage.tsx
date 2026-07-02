import { useEffect } from 'react'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorState } from '../components/common/ErrorState'
import { LoadingState } from '../components/common/LoadingState'
import { PageHeader } from '../components/common/PageHeader'
import {
  sourceKey,
  toStatisticsSource,
  useStatisticsStore
} from '../stores/statisticsStore'
import type {
  AlbumStat,
  ArtistStat,
  MusicStatsSummary,
  SongTimeStat,
  StatisticsSource,
  StatisticsSourceInfo
} from '../types/statistics'

const MONTH_LIMIT = 24

export function StatisticsPage(): JSX.Element {
  const {
    sources,
    selectedSource,
    summary,
    loadingSources,
    loadingSummary,
    error,
    loadSources,
    setSelectedSource,
    loadSummary,
    reset
  } = useStatisticsStore()

  useEffect(() => {
    loadSources()

    return () => reset()
  }, [loadSources, reset])

  const handleSourceChange = (value: string): void => {
    const sourceInfo = sources.find((source) => sourceInfoKey(source) === value)
    const nextSource = toStatisticsSource(sourceInfo)

    if (nextSource) {
      setSelectedSource(nextSource)
      void loadSummary(nextSource)
    }
  }

  const selectedValue = selectedSource ? sourceKey(selectedSource) : ''

  return (
    <div>
      <PageHeader
        title="数据统计"
        description="基于本地缓存的网易云音乐数据，查看你的音乐偏好概览。"
      />

      <section className="rounded-md border bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 flex-1">
            <label className="text-sm font-medium" htmlFor="statistics-source">
              数据来源
            </label>
            <select
              id="statistics-source"
              value={selectedValue}
              onChange={(event) => handleSourceChange(event.target.value)}
              disabled={loadingSources || sources.length === 0}
              className="mt-2 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sources.length === 0 ? <option value="">暂无可统计数据来源</option> : null}
              {sources.map((source) => (
                <option key={sourceInfoKey(source)} value={sourceInfoKey(source)}>
                  {sourceLabel(source)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!selectedSource || loadingSummary}
            onClick={() => void loadSummary()}
            className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            刷新统计
          </button>
        </div>
      </section>

      {loadingSources || loadingSummary ? (
        <div className="mt-6">
          <LoadingState message={loadingSources ? '正在读取统计来源...' : '正在生成统计数据...'} />
        </div>
      ) : null}

      {error ? (
        <div className="mt-6">
          <ErrorState message={error} />
        </div>
      ) : null}

      {!loadingSources && !loadingSummary && !error && !summary ? (
        <div className="mt-6">
          <EmptyState
            title="当前还没有可统计的数据"
            description="请先同步“我喜欢的音乐”或指定歌单歌曲，然后再查看统计。"
          />
        </div>
      ) : null}

      {summary ? <SummaryContent summary={summary} /> : null}
    </div>
  )
}

function SummaryContent({ summary }: { summary: MusicStatsSummary }): JSX.Element {
  const hasSongs = summary.overview.uniqueSongCount > 0

  if (!hasSongs) {
    return (
      <div className="mt-6">
        <EmptyState
          title="当前来源没有歌曲数据"
          description="请先完成对应来源的本地同步，再查看统计结果。"
        />
      </div>
    )
  }

  return (
    <>
      <section className="mt-6 grid gap-4 md:grid-cols-5">
        <Metric label="歌曲总数" value={`${summary.overview.songCount} 首`} />
        <Metric label="去重歌曲数" value={`${summary.overview.uniqueSongCount} 首`} />
        <Metric label="歌手数量" value={`${summary.overview.artistCount} 位`} />
        <Metric label="专辑数量" value={`${summary.overview.albumCount} 张`} />
        <Metric label="时间范围" value={summary.overview.timeCoverageLabel ?? '暂无时间'} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <TopArtistsTable artists={summary.topArtists.slice(0, 20)} />
        <TopAlbumsTable albums={summary.topAlbums.slice(0, 20)} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <DistributionPanel
          title="按年份分布"
          items={summary.timeDistribution.byYear.map((item) => ({
            label: item.year,
            count: item.count
          }))}
        />
        <DistributionPanel
          title="按月份分布"
          items={summary.timeDistribution.byMonth.slice(-MONTH_LIMIT).map((item) => ({
            label: item.month,
            count: item.count
          }))}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <SongTimeTable title={recentTitle(summary.source.type)} songs={summary.recentSongs.slice(0, 10)} />
        <SongTimeTable title={earliestTitle(summary.source.type)} songs={summary.earliestSongs.slice(0, 10)} />
      </section>

      {summary.playlistOverview ? (
        <section className="mt-6 rounded-md border bg-white p-6">
          <h3 className="text-lg font-semibold">歌单概览</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <Metric label="歌单总数" value={`${summary.playlistOverview.totalPlaylists} 个`} />
            <Metric label="已同步歌单" value={`${summary.playlistOverview.syncedPlaylistCount ?? 0} 个`} />
            <Metric label="歌单歌曲条目" value={`${summary.playlistOverview.totalTracksInPlaylists ?? 0} 条`} />
            <Metric label="收藏歌单" value={`${summary.playlistOverview.subscribedCount} 个`} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            我喜欢 {summary.playlistOverview.likedCount}，我创建 {summary.playlistOverview.createdCount}，
            我收藏 {summary.playlistOverview.subscribedCount}，未知 {summary.playlistOverview.unknownCount}
          </p>
        </section>
      ) : null}

      <p className="mt-4 text-sm text-muted-foreground">
        统计来源：{summary.source.name}，生成时间：{formatDateTime(summary.generatedAt)}
      </p>
    </>
  )
}

function TopArtistsTable({ artists }: { artists: ArtistStat[] }): JSX.Element {
  return (
    <section className="rounded-md border bg-white p-6">
      <h3 className="text-lg font-semibold">Top 歌手</h3>
      {artists.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="暂无歌手统计" description="当前数据缺少歌手信息。" />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">排名</th>
                <th className="px-4 py-3 font-medium">歌手</th>
                <th className="px-4 py-3 font-medium">歌曲数量</th>
                <th className="px-4 py-3 font-medium">占比</th>
                <th className="px-4 py-3 font-medium">代表歌曲</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {artists.map((artist, index) => (
                <tr key={artist.name} className="hover:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{index + 1}</td>
                  <td className="min-w-32 px-4 py-3 font-medium">{artist.name}</td>
                  <td className="whitespace-nowrap px-4 py-3">{artist.count}</td>
                  <td className="whitespace-nowrap px-4 py-3">{artist.percentage}%</td>
                  <td className="min-w-48 px-4 py-3 text-muted-foreground">
                    {artist.sampleSongs.map((song) => song.name).join(' / ') || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function TopAlbumsTable({ albums }: { albums: AlbumStat[] }): JSX.Element {
  return (
    <section className="rounded-md border bg-white p-6">
      <h3 className="text-lg font-semibold">Top 专辑</h3>
      {albums.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="暂无专辑统计" description="当前数据缺少专辑信息。" />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">排名</th>
                <th className="px-4 py-3 font-medium">专辑</th>
                <th className="px-4 py-3 font-medium">歌曲数量</th>
                <th className="px-4 py-3 font-medium">占比</th>
                <th className="px-4 py-3 font-medium">代表歌曲</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {albums.map((album, index) => (
                <tr key={album.name} className="hover:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{index + 1}</td>
                  <td className="min-w-40 px-4 py-3 font-medium">{album.name}</td>
                  <td className="whitespace-nowrap px-4 py-3">{album.count}</td>
                  <td className="whitespace-nowrap px-4 py-3">{album.percentage}%</td>
                  <td className="min-w-48 px-4 py-3 text-muted-foreground">
                    {album.sampleSongs.map((song) => song.name).join(' / ') || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function DistributionPanel({
  items,
  title
}: {
  items: Array<{ label: string; count: number }>
  title: string
}): JSX.Element {
  const maxCount = Math.max(1, ...items.map((item) => item.count))

  return (
    <section className="rounded-md border bg-white p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="暂无时间分布" description="当前数据没有可用的收藏或加入时间。" />
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {items.map((item) => (
            <div key={item.label} className="grid gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground">{item.count} 首</span>
              </div>
              <div className="h-2 rounded bg-muted">
                <div
                  className="h-2 rounded bg-primary"
                  style={{ width: `${Math.max(4, (item.count / maxCount) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function SongTimeTable({ songs, title }: { songs: SongTimeStat[]; title: string }): JSX.Element {
  return (
    <section className="rounded-md border bg-white p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      {songs.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="暂无时间歌曲" description="当前数据缺少可用时间字段。" />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">歌名</th>
                <th className="px-4 py-3 font-medium">歌手</th>
                <th className="px-4 py-3 font-medium">专辑</th>
                <th className="px-4 py-3 font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {songs.map((song) => (
                <tr key={`${song.ncmSongId}-${song.time ?? ''}`} className="hover:bg-muted/40">
                  <td className="min-w-48 px-4 py-3 font-medium">{song.name}</td>
                  <td className="min-w-40 px-4 py-3">{song.artists.join(' / ') || '-'}</td>
                  <td className="min-w-48 px-4 py-3 text-muted-foreground">{song.album ?? '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {song.timeLabel ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border bg-white p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  )
}

function sourceInfoKey(source: StatisticsSourceInfo): string {
  return source.type === 'playlist' ? `playlist:${source.id ?? ''}` : source.type
}

function sourceLabel(source: StatisticsSourceInfo): string {
  if (source.type === 'playlist') {
    return `歌单：${source.name}`
  }

  return source.name
}

function recentTitle(type: StatisticsSource['type']): string {
  if (type === 'liked') {
    return '最近收藏'
  }

  if (type === 'playlist') {
    return '最近加入歌单'
  }

  return '最近出现'
}

function earliestTitle(type: StatisticsSource['type']): string {
  if (type === 'liked') {
    return '最早收藏'
  }

  if (type === 'playlist') {
    return '最早加入歌单'
  }

  return '最早出现'
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}
