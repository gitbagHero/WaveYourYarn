import { useState } from 'react'
import { backupApi } from '../../api/backupApi'
import type { BackupRestoreSelection } from '../../types/backup'

export function BackupPanel(): JSX.Element {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selection, setSelection] = useState<BackupRestoreSelection | null>(null)

  const createBackup = async (): Promise<void> => {
    setLoading(true)
    setMessage(null)
    const result = await backupApi.create()

    if (result.success) {
      setMessage(result.data ? `备份已创建：${result.data.fileName}` : null)
    } else {
      setMessage(result.message ?? '创建数据库备份失败')
    }

    setLoading(false)
  }

  const selectForRestore = async (): Promise<void> => {
    setLoading(true)
    setMessage(null)
    const result = await backupApi.selectForRestore()

    if (result.success) {
      setSelection(result.data ?? null)
      setMessage(result.data ? '备份校验通过，请核对摘要后确认恢复' : null)
    } else {
      setSelection(null)
      setMessage(result.message ?? '备份文件校验失败')
    }

    setLoading(false)
  }

  const restoreBackup = async (): Promise<void> => {
    if (!selection) {
      return
    }

    const confirmed = window.confirm(
      '恢复会替换当前本地数据库，并在恢复前自动保存紧急备份。登录凭据不会从备份中恢复。确认继续吗？'
    )

    if (!confirmed) {
      return
    }

    setLoading(true)
    setMessage('正在恢复数据库，请不要关闭应用...')
    const result = await backupApi.restore(selection.token)

    if (result.success) {
      setMessage('数据库恢复完成，应用即将重启')
      setSelection(null)
    } else {
      setMessage(result.message ?? '恢复数据库失败')
      setSelection(null)
    }

    setLoading(false)
  }

  return (
    <section className="mt-6 rounded-md border bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">数据备份与恢复</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            备份包含本地音乐数据、公开设置和导出历史，不包含 Cookie 等安全存储凭据。恢复前会校验文件并自动保存当前数据库。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void createBackup()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '处理中...' : '创建数据库备份'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void selectForRestore()}
            className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            选择备份并恢复
          </button>
        </div>
      </div>

      {selection ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
          <h4 className="font-medium text-amber-900">恢复预览</h4>
          <dl className="mt-3 grid gap-2 text-sm text-amber-900 sm:grid-cols-2 lg:grid-cols-3">
            <PreviewItem label="文件" value={selection.preview.fileName} />
            <PreviewItem label="创建时间" value={formatDateTime(selection.preview.createdAt)} />
            <PreviewItem label="应用版本" value={`v${selection.preview.appVersion}`} />
            <PreviewItem label="数据库版本" value={`schema ${selection.preview.schemaVersion}`} />
            <PreviewItem label="歌曲" value={`${selection.preview.counts.songs} 首`} />
            <PreviewItem label="歌单" value={`${selection.preview.counts.playlists} 个`} />
            <PreviewItem
              label="歌单歌曲关系"
              value={`${selection.preview.counts.playlistSongs} 条`}
            />
            <PreviewItem
              label="导出历史"
              value={`${selection.preview.counts.exportRecords} 条`}
            />
            <PreviewItem label="数据库大小" value={formatBytes(selection.preview.databaseSizeBytes)} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void restoreBackup()}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              确认恢复并重启
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setSelection(null)}
              className="rounded-md border border-amber-300 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
    </section>
  )
}

function PreviewItem({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-xs opacity-75">{label}</dt>
      <dd className="mt-1 break-all font-medium">{value}</dd>
    </div>
  )
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
