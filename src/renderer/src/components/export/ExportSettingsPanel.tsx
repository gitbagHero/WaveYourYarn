import type {
  ExportFormat,
  ExportScope,
  ExportSortMode,
  ExportSourceType
} from '../../types/export'
import type { Playlist } from '../../types/playlist'

interface ExportSettingsPanelProps {
  canExport: boolean
  exporting: boolean
  format: ExportFormat
  keyword: string
  loadingPlaylists: boolean
  playlistError: string | null
  playlists: Playlist[]
  scope: ExportScope
  selectedPlaylistId: string
  sortMode: ExportSortMode
  sourceName: string
  sourceType: ExportSourceType
  onExport: () => void
  onFormatChange: (format: ExportFormat) => void
  onKeywordChange: (keyword: string) => void
  onPlaylistChange: (playlistId: string) => void
  onScopeChange: (scope: ExportScope) => void
  onSortModeChange: (sortMode: ExportSortMode) => void
  onSourceChange: (sourceType: ExportSourceType) => void
}

const formatOptions: Array<{ value: ExportFormat; label: string; description: string }> = [
  { value: 'csv', label: 'CSV', description: '适合 Excel / Numbers 查看' },
  { value: 'json', label: 'JSON', description: '适合后续程序处理和备份' },
  { value: 'markdown', label: 'Markdown', description: '适合笔记、博客、报告使用' }
]

export function ExportSettingsPanel({
  canExport,
  exporting,
  format,
  keyword,
  loadingPlaylists,
  playlistError,
  playlists,
  scope,
  selectedPlaylistId,
  sortMode,
  sourceName,
  sourceType,
  onExport,
  onFormatChange,
  onKeywordChange,
  onPlaylistChange,
  onScopeChange,
  onSortModeChange,
  onSourceChange
}: ExportSettingsPanelProps): JSX.Element {
  const sortOptions = getSortOptions(sourceType)

  return (
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
              onClick={() => onSourceChange('liked')}
            />
            <SourceButton
              active={sourceType === 'playlist'}
              label="指定歌单"
              description="导出已经同步到本地的任意歌单歌曲"
              onClick={() => onSourceChange('playlist')}
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
              onChange={(event) => onPlaylistChange(event.target.value)}
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
                onClick={() => onFormatChange(option.value)}
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
              onChange={(event) => onScopeChange(event.target.value as ExportScope)}
              className="mt-2 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="all">
                {sourceType === 'liked' ? '全部喜欢歌曲' : '当前歌单全部歌曲'}
              </option>
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
              onChange={(event) => onSortModeChange(event.target.value as ExportSortMode)}
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
                onChange={(event) => onKeywordChange(event.target.value)}
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
            onClick={onExport}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? '导出中...' : '开始导出'}
          </button>
          <p className="mt-2 text-sm text-muted-foreground">当前来源：{sourceName}</p>
        </div>
      </div>
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
      className={`rounded-md border p-4 text-left ${active ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
    >
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  )
}

function getSortOptions(
  sourceType: ExportSourceType
): Array<{ value: ExportSortMode; label: string }> {
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
