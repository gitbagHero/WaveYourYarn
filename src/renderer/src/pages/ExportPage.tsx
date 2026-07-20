import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { playlistsApi } from '../api/playlistsApi'
import { songsApi } from '../api/songsApi'
import { ErrorState } from '../components/common/ErrorState'
import { PageHeader } from '../components/common/PageHeader'
import {
  ActionButton,
  ExportHistoryPanel,
  formatDateTime,
  sourceLabel
} from '../components/export/ExportHistoryPanel'
import { ExportSearchPreview } from '../components/export/ExportSearchPreview'
import { ExportSettingsPanel } from '../components/export/ExportSettingsPanel'
import { useExportStore } from '../stores/exportStore'
import type { ExportFormat, ExportScope, ExportSortMode, ExportSourceType } from '../types/export'
import type { Playlist } from '../types/playlist'
import { sortPreviewSongs, type PreviewSong } from '../utils/exportPreview'

const SEARCH_PAGE_SIZE = 15

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
        if (!cancelled) {
          setPlaylists(items)
          setLoadingPlaylists(false)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPlaylistError(error instanceof Error ? error.message : String(error))
          setPlaylists([])
          setLoadingPlaylists(false)
        }
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
      resetSearchPreview()
      return
    }

    const trimmedKeyword = keyword.trim()

    if (!trimmedKeyword) {
      resetSearchPreview()
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
        if (!cancelled) {
          setSearchResults(sortPreviewSongs(songs, sourceType, sortMode))
          setSearchPage(1)
          setSearching(false)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSearchError(error instanceof Error ? error.message : String(error))
          setSearchResults([])
          setSearchPage(1)
          setSearching(false)
        }
      })

    return () => {
      cancelled = true
    }

    function resetSearchPreview(): void {
      setSearchResults([])
      setSearchError(null)
      setSearching(false)
      setSearchPage(1)
    }
  }, [keyword, scope, selectedPlaylistId, sortMode, sourceType])

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId),
    [playlists, selectedPlaylistId]
  )
  const pageCount = Math.max(1, Math.ceil(searchResults.length / SEARCH_PAGE_SIZE))
  const currentSearchPage = Math.min(searchPage, pageCount)
  const pagedSearchResults = searchResults.slice(
    (currentSearchPage - 1) * SEARCH_PAGE_SIZE,
    currentSearchPage * SEARCH_PAGE_SIZE
  )
  const sourceName =
    sourceType === 'liked' ? '我喜欢的音乐' : (selectedPlaylist?.name ?? '未选择歌单')
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

      <ExportSettingsPanel
        canExport={canExport}
        exporting={exporting}
        format={format}
        keyword={keyword}
        loadingPlaylists={loadingPlaylists}
        playlistError={playlistError}
        playlists={playlists}
        scope={scope}
        selectedPlaylistId={selectedPlaylistId}
        sortMode={sortMode}
        sourceName={sourceName}
        sourceType={sourceType}
        onExport={() => void handleExport()}
        onFormatChange={setFormat}
        onKeywordChange={setKeyword}
        onPlaylistChange={setSelectedPlaylistId}
        onScopeChange={setScope}
        onSortModeChange={setSortMode}
        onSourceChange={handleSourceChange}
      />

      {scope === 'filtered' ? (
        <ExportSearchPreview
          currentPage={currentSearchPage}
          keyword={keyword}
          pageCount={pageCount}
          pagedSongs={pagedSearchResults}
          searchError={searchError}
          pageSize={SEARCH_PAGE_SIZE}
          searching={searching}
          songCount={searchResults.length}
          setPage={setSearchPage}
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
            <InfoRow
              label="来源"
              value={lastResult.sourceName ?? sourceLabel(lastResult.sourceType)}
            />
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

      <ExportHistoryPanel
        loading={loadingRecords}
        records={records}
        onClear={() => void handleClearRecords()}
        onOpenFile={(recordId) => void openFile(recordId)}
        onOpenFolder={(recordId) => void openFolder(recordId)}
      />
    </div>
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
