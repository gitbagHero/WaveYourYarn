import type { Dispatch, SetStateAction } from 'react'
import { EmptyState } from '../common/EmptyState'
import { ErrorState } from '../common/ErrorState'
import { LoadingState } from '../common/LoadingState'
import type { ExportSourceType } from '../../types/export'
import { getPreviewSongTime, type PreviewSong } from '../../utils/exportPreview'

interface ExportSearchPreviewProps {
  currentPage: number
  keyword: string
  pageCount: number
  pageSize: number
  pagedSongs: PreviewSong[]
  searchError: string | null
  searching: boolean
  songCount: number
  setPage: Dispatch<SetStateAction<number>>
  sourceType: ExportSourceType
  timeColumnLabel: string
}

export function ExportSearchPreview({
  currentPage,
  keyword,
  pageCount,
  pageSize,
  pagedSongs,
  searchError,
  searching,
  songCount,
  setPage,
  sourceType,
  timeColumnLabel
}: ExportSearchPreviewProps): JSX.Element {
  return (
    <section className="mt-6 rounded-md border bg-white p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">搜索结果预览</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            每页显示 {pageSize} 首，导出时会导出全部匹配结果。
          </p>
        </div>
        {songCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            共 {songCount} 首，第 {currentPage} / {pageCount} 页
          </p>
        ) : null}
      </div>

      {!keyword.trim() ? (
        <div className="mt-4">
          <EmptyState
            title="请输入搜索关键词"
            description="输入歌名、歌手或专辑后会在这里列出匹配歌曲。"
          />
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

      {!searching && keyword.trim() && !searchError && songCount === 0 ? (
        <div className="mt-4">
          <EmptyState title="没有匹配的歌曲" description="请调整搜索关键词后再导出筛选结果。" />
        </div>
      ) : null}

      {pagedSongs.length > 0 ? (
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
                {pagedSongs.map((song, index) => (
                  <tr key={`${sourceType}-${song.id}`} className="hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>
                    <td className="min-w-48 px-4 py-3 font-medium">{song.name}</td>
                    <td className="min-w-40 px-4 py-3">{song.artists.join(' / ') || '-'}</td>
                    <td className="min-w-48 px-4 py-3 text-muted-foreground">
                      {song.album ?? '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatTimestamp(getPreviewSongTime(song, sourceType) ?? undefined)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((page) => Math.max(1, page - 1))}
              className="rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              上一页
            </button>
            <span className="text-sm text-muted-foreground">
              第 {currentPage} / {pageCount} 页
            </span>
            <button
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() => setPage((page) => Math.min(pageCount, page + 1))}
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

function formatTimestamp(timestamp?: number): string {
  return timestamp ? new Date(timestamp).toLocaleString() : '未知'
}
