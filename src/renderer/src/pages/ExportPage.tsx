import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/common/EmptyState'
import { ErrorState } from '../components/common/ErrorState'
import { LoadingState } from '../components/common/LoadingState'
import { PageHeader } from '../components/common/PageHeader'
import { playlistsApi } from '../api/playlistsApi'
import { songsApi } from '../api/songsApi'
import { useExportStore } from '../stores/exportStore'
import type { ExportFormat, ExportScope, ExportSortMode, ExportSourceType } from '../types/export'
import type { Playlist } from '../types/playlist'
import type { LikedSong, PlaylistTrack } from '../types/song'

const SEARCH_PAGE_SIZE = 15

type PreviewSong = LikedSong | PlaylistTrack

const formatOptions: Array<{ value: ExportFormat; label: string; description: string }> = [
  { value: 'csv', label: 'CSV', description: '适合 Excel / Numbers 查看' },
  { value: 'json', label: 'JSON', description: '适合后续程序处理和备份' },
  { value: 'markdown', label: 'Markdown', description: '适合笔记、博客、报告使用' }
]

function getSortOptions(sourceType: ExportSourceType): Array<{ value: ExportSortMode; label: string }> {
  return sourceType === 'liked'
    ? [
        { value: 'timeDesc', label: '收藏时间新到旧' },
        { value: 'timeAsc', label: '收藏时间旧到新' },
        { value: 'originalOrder', label: '网易云原始顺序' }
      ]
    : [
        { value: 'timeDesc', label: '加入时间新到旧' },
        { value: 'timeAsc', label: '加入时间旧到新' },
        { value: 'originalOrder', label: '歌单原始顺序' }
      ]
}

export function ExportPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const {
    exporting,
    loadingRecords,
    records,
    error,
    lastResult,
    exportSongs,
    loadRecords,
    openFile,
    openFolder,
    clearRecords
  } = useExportStore()
  const [sourceType, setSourceType] = useState<ExportSourceType>('liked')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('')
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loadingPlaylists, setLoadingPlaylists] = useState(false)
  const [playlistError, setPlaylistError] = useState<string | null>(null)
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [scope, setScope] = useState<ExportScope>('all')
  const [keyword, setKeyword] = useState('')
  const [sortMode, setSortMode] = useState<ExportSortMode>('timeDesc')
  const [searchResults, setSearchResults] = useState<PreviewSong[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchPage, setSearchPage] = useState(1)

  const sourceParam = searchParams.get('source')
  const playlistIdParam = searchParams.get('playlistId')

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  useEffect(() => {
    if (sourceParam === 'playlist') {
      setSourceType('playlist')
      setSelectedPlaylistId(playlistIdParam ?? '')
    }
  }, [playlistIdParam, sourceParam])

  useEffect(() => {
    let cancelled = false
    setLoadingPlaylists(true)
    setPlaylistError(null)

    playlistsApi
      .getPlaylists()
      .then((items) => {
        if (cancelled) {
          return
        }

        setPlaylists(items)
        setLoadingPlaylists(false)
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setPlaylistError(error instanceof Error ? error.message : String(error))
        setPlaylists([])
        setLoadingPlaylists(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (sourceType === 'playlist' && !selectedPlaylistId && playlists.length > 0) {
      setSelectedPlaylistId(playlists[0].id)
    }
  }, [playlists, selectedPlaylistId, sourceType])

  useEffect(() => {
    setSearchResults([])
    setSearchError(null)
    setSearching(false)
    setSearchPage(1)
  }, [selectedPlaylistId, sourceType])

  useEffect(() => {
    if (scope !== 'filtered') {
      setSearchResults([])
      setSearchError(null)
      setSearching(false)
      setSearchPage(1)
      return
    }

    const trimmedKeyword = keyword.trim()

    if (!trimmedKeyword) {
      setSearchResults([])
      setSearchError(null)
      setSearching(false)
      setSearchPage(1)
      return
    }

    if (sourceType === 'playlist' && !selectedPlaylistId) {
      setSearchResults([])
      setSearchError('请先选择要导出的歌单')
      setSearching(false)
      setSearchPage(1)
      return
    }

    let cancelled = false
    setSearching(true)
    setSearchError(null)

    const searchTask =
      sourceType === 'liked'
        ? songsApi.searchLikedSongs(trimmedKeyword)
        : playlistsApi.searchPlaylistSongs(selectedPlaylistId, trimmedKeyword)

    searchTask
      .then((songs) => {
        if (cancelled) {
          return
        }

        setSearchResults(sortSongs(songs, sourceType, sortMode))
        setSearchPage(1)
        setSearching(false)
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setSearchError(error instanceof Error ? error.message : String(error))
        setSearchResults([])
        setSearchPage(1)
        setSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [keyword, scope, selectedPlaylistId, sortMode, sourceType])

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId),
    [playlists, selectedPlaylistId]
  )
  const sortOptions = getSortOptions(sourceType)
  const pageCount = Math.max(1, Math.ceil(searchResults.length / SEARCH_PAGE_SIZE))
  const currentSearchPage = Math.min(searchPage, pageCount)
  const pagedSearchResults = searchResults.slice(
    (currentSearchPage - 1) * SEARCH_PAGE_SIZE,
    currentSearchPage * SEARCH_PAGE_SIZE
  )
  const sourceName = sourceType === 'liked' ? '我喜欢的音乐' : selectedPlaylist?.name ?? '未选择歌单'
  const timeColumnLabel = sourceType === 'liked' ? '收藏时间' : '加入歌单时间'
  const canExport = !exporting && (sourceType === 'liked' || Boolean(selectedPlaylistId))

  const handleSourceChange = (value: ExportSourceType): void => {
    setSourceType(value)
    setSortMode('timeDesc')
    setSearchPage(1)
  }

  const handleExport = async (): Promise<void> => {
    await exportSongs({
      source:
        sourceType === 'playlist'
          ? { type: 'playlist', playlistId: selectedPlaylistId }
          : { type: 'liked' },
      format,
      scope,
      keyword: scope === 'filtered' ? keyword : undefined,
      sortMode
    })
  }

  const handleClearRecords = async (): Promise<void> => {
    const confirmed = window.confirm(
      '确认清空导出历史吗？这不会删除实际导出的文件，只会清除 WaveYourYarn 中的记录。'
    )

    if (confirmed) {
      await clearRecords()
    }
  }

  return (
    <div>
      <PageHeader
        title="数据导出"
        description="将本地缓存的网易云喜欢歌曲或歌单歌曲导出为 CSV、JSON 或 Markdown 文件"
      />

      <section className="rounded-md border bg-white p-6">
        <h3 className="text-lg font-semibold">导出设置</h3>
        <div className="mt-5 grid gap-5">
          <div>
            <label className="text-sm font-medium">导出来源</label>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <SourceButton
                active={sourceType === 'liked'}
                label="我喜欢的音乐"
                description="导出已经同步到本地的喜欢歌曲"
                onClick={() => handleSourceChange('liked')}
              />
              <SourceButton
                active={sourceType === 'playlist'}
                label="指定歌单"
                description="导出已经同步到本地的任意歌单歌曲"
                onClick={() => handleSourceChange('playlist')}
              />
            </div>
          </div>

          {sourceType === 'playlist' ? (
            <div>
              <label className="text-sm font-medium" htmlFor="export-playlist">
                选择歌单
              </label>
              <select
                id="export-playlist"
                value={selectedPlaylistId}
                onChange={(event) => setSelectedPlaylistId(event.target.value)}
                disabled={loadingPlaylists || playlists.length === 0}
                className="mt-2 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {playlists.length === 0 ? <option value="">暂无本地歌单缓存</option> : null}
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>
              {loadingPlaylists ? (
                <p className="mt-2 text-sm text-muted-foreground">正在读取本地歌单列表...</p>
              ) : null}
              {playlistError ? <p className="mt-2 text-sm text-red-700">{playlistError}</p> : null}
              {!loadingPlaylists && playlists.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  还没有同步歌单列表，请先到歌单页面同步。
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium">导出格式</label>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              {formatOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormat(option.value)}
                  className={`rounded-md border p-4 text-left ${
                    format === option.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                >
                  <p className="font-medium">{option.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium" htmlFor="export-scope">
                导出范围
              </label>
              <select
                id="export-scope"
                value={scope}
                onChange={(event) => setScope(event.target.value as ExportScope)}
                className="mt-2 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="all">{sourceType === 'liked' ? '全部喜欢歌曲' : '当前歌单全部歌曲'}</option>
                <option value="filtered">当前搜索筛选结果</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="export-sort">
                排序方式
              </label>
              <select
                id="export-sort"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as ExportSortMode)}
                className="mt-2 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {scope === 'filtered' ? (
              <div>
                <label className="text-sm font-medium" htmlFor="export-keyword">
                  搜索关键词
                </label>
                <input
                  id="export-keyword"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="例如：周杰伦"
                  className="mt-2 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            ) : null}
          </div>

          <div>
            <button
              type="button"
              disabled={!canExport}
              onClick={() => void handleExport()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? '导出中...' : '开始导出'}
            </button>
            <p className="mt-2 text-sm text-muted-foreground">当前来源：{sourceName}</p>
          </div>
        </div>
      </section>

      {scope === 'filtered' ? (
        <SearchPreview
          currentSearchPage={currentSearchPage}
          keyword={keyword}
          pageCount={pageCount}
          pagedSearchResults={pagedSearchResults}
          searchError={searchError}
          searchPageSize={SEARCH_PAGE_SIZE}
          searching={searching}
          searchResultsCount={searchResults.length}
          setSearchPage={setSearchPage}
          sourceType={sourceType}
          timeColumnLabel={timeColumnLabel}
        />
      ) : null}

      {error ? (
        <div className="mt-6">
          <ErrorState message={error} />
        </div>
      ) : null}

      {lastResult ? (
        <section className="mt-6 rounded-md border bg-white p-6">
          <h3 className="text-lg font-semibold">最近一次导出</h3>
          <dl className="mt-4 grid gap-3 text-sm">
            <InfoRow label="来源" value={lastResult.sourceName ?? sourceLabel(lastResult.sourceType)} />
            <InfoRow label="格式" value={lastResult.format.toUpperCase()} />
            <InfoRow label="歌曲数量" value={`${lastResult.songCount} 首`} />
            <InfoRow label="导出时间" value={formatDateTime(lastResult.exportedAt)} />
            <InfoRow label="文件路径" value={lastResult.filePath} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-3">
            <ActionButton label="打开文件" onClick={() => void openFile(lastResult.id)} />
            <ActionButton label="打开所在目录" onClick={() => void openFolder(lastResult.id)} />
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-md border bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">导出历史</h3>
            <p className="mt-1 text-sm text-muted-foreground">历史记录只保存文件位置，不会复制导出文件。</p>
          </div>
          {records.length > 0 ? (
            <button
              type="button"
              onClick={() => void handleClearRecords()}
              className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              清空历史
            </button>
          ) : null}
        </div>

        {loadingRecords ? (
          <div className="mt-4">
            <LoadingState message="正在读取导出历史..." />
          </div>
        ) : null}

        {!loadingRecords && records.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="暂无导出记录" description="完成第一次歌曲导出后，历史记录会显示在这里。" />
          </div>
        ) : null}

        {records.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">来源</th>
                  <th className="px-4 py-3 font-medium">格式</th>
                  <th className="px-4 py-3 font-medium">歌曲数量</th>
                  <th className="px-4 py-3 font-medium">导出时间</th>
                  <th className="px-4 py-3 font-medium">文件路径</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-muted/40">
                    <td className="min-w-36 px-4 py-3 font-medium">
                      {record.sourceName ?? sourceLabel(record.sourceType)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {record.exportType.toUpperCase()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{record.songCount} 首</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDateTime(record.createdAt)}
                    </td>
                    <td className="min-w-80 px-4 py-3 text-muted-foreground">{record.filePath}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex gap-2">
                        <ActionButton label="打开文件" onClick={() => void openFile(record.id)} />
                        <ActionButton label="打开目录" onClick={() => void openFolder(record.id)} />
                      </div>
                    </td>
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

function SearchPreview({
  currentSearchPage,
  keyword,
  pageCount,
  pagedSearchResults,
  searchError,
  searchPageSize,
  searching,
  searchResultsCount,
  setSearchPage,
  sourceType,
  timeColumnLabel
}: {
  currentSearchPage: number
  keyword: string
  pageCount: number
  pagedSearchResults: PreviewSong[]
  searchError: string | null
  searchPageSize: number
  searching: boolean
  searchResultsCount: number
  setSearchPage: Dispatch<SetStateAction<number>>
  sourceType: ExportSourceType
  timeColumnLabel: string
}): JSX.Element {
  return (
    <section className="mt-6 rounded-md border bg-white p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">搜索结果预览</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            每页显示 {searchPageSize} 首，导出时会导出全部匹配结果。
          </p>
        </div>
        {searchResultsCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            共 {searchResultsCount} 首，第 {currentSearchPage} / {pageCount} 页
          </p>
        ) : null}
      </div>

      {!keyword.trim() ? (
        <div className="mt-4">
          <EmptyState title="请输入搜索关键词" description="输入歌名、歌手或专辑后会在这里列出匹配歌曲。" />
        </div>
      ) : null}

      {searching ? (
        <div className="mt-4">
          <LoadingState message="正在搜索本地歌曲..." />
        </div>
      ) : null}

      {searchError ? (
        <div className="mt-4">
          <ErrorState message={searchError} />
        </div>
      ) : null}

      {!searching && keyword.trim() && !searchError && searchResultsCount === 0 ? (
        <div className="mt-4">
          <EmptyState title="没有匹配的歌曲" description="请调整搜索关键词后再导出筛选结果。" />
        </div>
      ) : null}

      {pagedSearchResults.length > 0 ? (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">序号</th>
                  <th className="px-4 py-3 font-medium">歌名</th>
                  <th className="px-4 py-3 font-medium">歌手</th>
                  <th className="px-4 py-3 font-medium">专辑</th>
                  <th className="px-4 py-3 font-medium">{timeColumnLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagedSearchResults.map((song, index) => (
                  <tr key={`${sourceType}-${song.id}`} className="hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {(currentSearchPage - 1) * searchPageSize + index + 1}
                    </td>
                    <td className="min-w-48 px-4 py-3 font-medium">{song.name}</td>
                    <td className="min-w-40 px-4 py-3">{song.artists.join(' / ') || '-'}</td>
                    <td className="min-w-48 px-4 py-3 text-muted-foreground">{song.album ?? '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatTimestamp(getSongTime(song, sourceType) ?? undefined)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={currentSearchPage <= 1}
              onClick={() => setSearchPage((page) => Math.max(1, page - 1))}
              className="rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              上一页
            </button>
            <span className="text-sm text-muted-foreground">
              第 {currentSearchPage} / {pageCount} 页
            </span>
            <button
              type="button"
              disabled={currentSearchPage >= pageCount}
              onClick={() => setSearchPage((page) => Math.min(pageCount, page + 1))}
              className="rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </>
      ) : null}
    </section>
  )
}

function SourceButton({
  active,
  description,
  label,
  onClick
}: {
  active: boolean
  description: string
  label: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border p-4 text-left ${
        active ? 'border-primary bg-primary/5' : 'hover:bg-muted'
      }`}
    >
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="grid gap-2 border-b pb-3 md:grid-cols-[120px_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all font-medium">{value}</dd>
    </div>
  )
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {label}
    </button>
  )
}

function sourceLabel(sourceType?: ExportSourceType): string {
  return sourceType === 'playlist' ? '歌单' : '我喜欢的音乐'
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

function formatTimestamp(timestamp?: number): string {
  return timestamp ? new Date(timestamp).toLocaleString() : '未知'
}

function sortSongs(
  songs: PreviewSong[],
  sourceType: ExportSourceType,
  sortMode: ExportSortMode
): PreviewSong[] {
  return [...songs].sort((a, b) => {
    if (sortMode === 'originalOrder') {
      return a.orderIndex - b.orderIndex
    }

    const aTime = getSongTime(a, sourceType)
    const bTime = getSongTime(b, sourceType)

    if (aTime === null && bTime === null) {
      return a.orderIndex - b.orderIndex
    }

    if (aTime === null) {
      return 1
    }

    if (bTime === null) {
      return -1
    }

    return sortMode === 'timeDesc' ? bTime - aTime : aTime - bTime
  })
}

function getSongTime(song: PreviewSong, sourceType: ExportSourceType): number | null {
  if (sourceType === 'liked') {
    return 'likedAt' in song && song.likedAt ? song.likedAt : null
  }

  return 'addedAt' in song && song.addedAt ? song.addedAt : null
}
