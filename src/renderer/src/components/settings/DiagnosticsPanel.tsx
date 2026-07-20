import { useEffect, useState } from 'react'
import { diagnosticsApi } from '../../api/diagnosticsApi'
import type { DiagnosticSummary } from '../../types/diagnostics'

export function DiagnosticsPanel(): JSX.Element {
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    diagnosticsApi.getSummary().then((result) => {
      if (result.success && result.data) {
        setSummary(result.data)
      } else {
        setMessage(result.message ?? '读取诊断信息失败')
      }
      setLoading(false)
    })
  }, [])

  const exportDiagnostics = async (): Promise<void> => {
    setLoading(true)
    setMessage(null)
    const result = await diagnosticsApi.export()

    if (result.success) {
      setMessage(result.data ? `脱敏诊断包已导出：${result.data.fileName}` : null)
    } else {
      setMessage(result.message ?? '导出诊断包失败')
    }

    setLoading(false)
  }

  return (
    <section className="mt-6 rounded-md border bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">运行环境与诊断</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            诊断包仅包含版本、平台、数据库数量摘要和最近的脱敏日志，不包含歌曲明细、登录凭据或绝对用户路径，也不会自动上传。
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void exportDiagnostics()}
          className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '读取中...' : '导出脱敏诊断包'}
        </button>
      </div>

      {summary ? (
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <DiagnosticItem label="应用 / Electron" value={`v${summary.application.version} / ${summary.application.electronVersion}`} />
          <DiagnosticItem label="Node / Chromium" value={`${summary.application.nodeVersion} / ${summary.application.chromiumVersion}`} />
          <DiagnosticItem label="平台" value={`${summary.application.platform}-${summary.application.architecture}`} />
          <DiagnosticItem label="数据库" value={`schema ${summary.database.schemaVersion} · ${summary.database.integrity}`} />
          <DiagnosticItem label="本地数据" value={`${summary.database.counts.songs} 首歌曲 · ${summary.database.counts.playlists} 个歌单`} />
          <DiagnosticItem label="网易云 Adapter" value={summary.adapters.netease.version} />
          <DiagnosticItem label="数据库文件" value={summary.storage.databaseFileAvailable ? '可用' : '不可用'} />
          <DiagnosticItem label="日志文件" value={summary.storage.logFileAvailable ? '可用' : '尚未生成'} />
          <DiagnosticItem label="系统安全存储" value={summary.storage.safeStorageAvailable ? '可用' : '不可用'} />
        </dl>
      ) : null}

      {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
    </section>
  )
}

function DiagnosticItem({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md bg-muted p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all font-medium">{value}</dd>
    </div>
  )
}
