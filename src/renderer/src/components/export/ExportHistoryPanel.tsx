import { EmptyState } from '../common/EmptyState'
import { LoadingState } from '../common/LoadingState'
import type { ExportRecord, ExportSourceType } from '../../types/export'

interface ExportHistoryPanelProps {
  loading: boolean
  records: ExportRecord[]
  onClear: () => void
  onOpenFile: (recordId: string) => void
  onOpenFolder: (recordId: string) => void
}

export function ExportHistoryPanel({
  loading,
  records,
  onClear,
  onOpenFile,
  onOpenFolder
}: ExportHistoryPanelProps): JSX.Element {
  return (
    <section className="mt-6 rounded-md border bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">导出历史</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            历史记录只保存文件位置，不会复制导出文件。
          </p>
        </div>
        {records.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            清空历史
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4">
          <LoadingState message="正在读取导出历史..." />
        </div>
      ) : null}

      {!loading && records.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="暂无导出记录"
            description="完成第一次歌曲导出后，历史记录会显示在这里。"
          />
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
                      <ActionButton label="打开文件" onClick={() => onOpenFile(record.id)} />
                      <ActionButton label="打开目录" onClick={() => onOpenFolder(record.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

export function ActionButton({
  label,
  onClick
}: {
  label: string
  onClick: () => void
}): JSX.Element {
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

export function sourceLabel(sourceType?: ExportSourceType): string {
  return sourceType === 'playlist' ? '歌单' : '我喜欢的音乐'
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}
