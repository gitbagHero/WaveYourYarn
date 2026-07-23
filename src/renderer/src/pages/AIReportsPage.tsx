import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '../components/common/EmptyState'
import { LoadingState } from '../components/common/LoadingState'
import { PageHeader } from '../components/common/PageHeader'
import {
  ReportGenerationPanel,
  type ReportRegenerationIntent
} from '../components/aiReports/ReportGenerationPanel'
import { ReportDetailView } from '../components/aiReports/ReportDetailView'
import { aiReportsApi } from '../api/aiReportsApi'
import { llmProfilesApi } from '../api/llmProfilesApi'
import { statisticsApi } from '../api/statisticsApi'
import type { AIReportDetail, AIReportSummary } from '../types/aiReport'
import type { AIDisclosureSourceRequest, PublicLLMProfile } from '../types/llm'
import type { StatisticsSourceInfo } from '../types/statistics'

export function AIReportsPage(): JSX.Element {
  const [profiles, setProfiles] = useState<PublicLLMProfile[]>([])
  const [sources, setSources] = useState<StatisticsSourceInfo[]>([])
  const [reports, setReports] = useState<AIReportSummary[]>([])
  const [detail, setDetail] = useState<AIReportDetail | null>(null)
  const [regenerationIntent, setRegenerationIntent] = useState<ReportRegenerationIntent>()
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadReports = useCallback(async (preferredId?: string): Promise<void> => {
    const result = await aiReportsApi.list()
    if (!result.success || !result.data) {
      setError(result.message ?? '读取 AI 报告历史失败')
      return
    }
    setReports(result.data)
    const nextId = preferredId ?? result.data[0]?.id
    if (!nextId) {
      setDetail(null)
      return
    }
    const detailResult = await aiReportsApi.get({ id: nextId })
    if (detailResult.success && detailResult.data) {
      setDetail(detailResult.data)
    } else if (preferredId) {
      setError(detailResult.message ?? '读取 AI 报告失败')
    }
  }, [])

  useEffect(() => {
    let active = true
    void Promise.all([
      llmProfilesApi.list(),
      statisticsApi.getSources().catch(() => [] as StatisticsSourceInfo[]),
      aiReportsApi.list()
    ]).then(async ([profilesResult, sourceResult, reportsResult]) => {
      if (!active) {
        return
      }
      if (profilesResult.success && profilesResult.data) {
        setProfiles(profilesResult.data)
      } else {
        setError(profilesResult.message ?? '读取模型配置失败')
      }
      setSources(sourceResult)
      if (reportsResult.success && reportsResult.data) {
        setReports(reportsResult.data)
        if (reportsResult.data[0]) {
          const detailResult = await aiReportsApi.get({ id: reportsResult.data[0].id })
          if (active && detailResult.success && detailResult.data) {
            setDetail(detailResult.data)
          }
        }
      } else {
        setError(reportsResult.message ?? '读取 AI 报告历史失败')
      }
      if (active) {
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const selectReport = async (id: string): Promise<void> => {
    setWorking(true)
    setError(null)
    const result = await aiReportsApi.get({ id })
    if (result.success && result.data) {
      setDetail(result.data)
    } else {
      setError(result.message ?? '读取 AI 报告失败')
    }
    setWorking(false)
  }

  const handleGenerated = useCallback(
    (generated: AIReportDetail): void => {
      setDetail(generated)
      setError(null)
      void loadReports(generated.report.id)
    },
    [loadReports]
  )

  const rename = async (userTitle: string): Promise<void> => {
    if (!detail) {
      return
    }
    setWorking(true)
    setError(null)
    const result = await aiReportsApi.rename({ id: detail.report.id, userTitle })
    if (result.success && result.data) {
      setDetail(result.data)
      await loadReports(result.data.report.id)
    } else {
      setError(result.message ?? '重命名报告失败')
    }
    setWorking(false)
  }

  const deleteReport = async (): Promise<void> => {
    if (!detail || !window.confirm(`确认删除本地报告“${detail.report.userTitle}”吗？`)) {
      return
    }
    setWorking(true)
    setError(null)
    const result = await aiReportsApi.delete({ id: detail.report.id })
    if (result.success) {
      setDetail(null)
      await loadReports()
    } else {
      setError(result.message ?? '删除报告失败')
    }
    setWorking(false)
  }

  const regenerate = (): void => {
    if (!detail?.sources[0]) {
      return
    }
    setRegenerationIntent({
      key: Date.now(),
      profileId: detail.report.profileId,
      source: sourceToRequest(detail.sources[0].sourceType, detail.sources[0].sourceId)
    })
    document.getElementById('ai-report-generator')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div>
      <PageHeader
        title="AI 音乐报告"
        description="使用你选择的模型分析最近收藏样本，并在本地保存可解释、可离线阅读的音乐偏好报告。"
      />

      {error ? <p className="mb-5 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <LoadingState message="正在读取报告配置与历史..." /> : null}

      {!loading ? (
        <ReportGenerationPanel
          profiles={profiles}
          sources={sources}
          regenerationIntent={regenerationIntent}
          onGenerated={handleGenerated}
        />
      ) : null}

      {!loading ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="rounded-md border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">报告历史</h3>
              <span className="text-xs text-muted-foreground">{reports.length} 份</span>
            </div>
            {reports.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="还没有 AI 报告"
                  description="完成上方确认流程后生成第一份报告。"
                />
              </div>
            ) : (
              <div className="mt-4 grid gap-2">
                {reports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    disabled={working}
                    onClick={() => void selectReport(report.id)}
                    className={[
                      'rounded-md border p-3 text-left',
                      detail?.report.id === report.id
                        ? 'border-primary bg-sky-50'
                        : 'hover:bg-muted/50'
                    ].join(' ')}
                  >
                    <span className="block truncate text-sm font-medium">{report.userTitle}</span>
                    <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                      {report.subtitle}
                    </span>
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {new Date(report.generatedAt).toLocaleString()} · {report.modelId}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <div>
            {detail ? (
              <ReportDetailView
                detail={detail}
                working={working}
                onRename={rename}
                onDelete={deleteReport}
                onRegenerate={regenerate}
              />
            ) : (
              <EmptyState
                title="选择一份报告查看详情"
                description="历史报告保存在本地，无网络时也可以继续阅读。"
              />
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function sourceToRequest(
  type: 'liked' | 'playlist' | 'all',
  sourceId?: string
): AIDisclosureSourceRequest {
  return type === 'playlist' ? { type, playlistId: sourceId } : { type }
}
