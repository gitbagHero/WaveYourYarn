import { useEffect, useState } from 'react'
import type { AIReportDetail, AIReportEvidence, AIReportInsight } from '../../types/aiReport'

interface ReportDetailViewProps {
  detail: AIReportDetail
  working: boolean
  onRename: (userTitle: string) => Promise<void>
  onDelete: () => Promise<void>
  onRegenerate: () => void
}

export function ReportDetailView({
  detail,
  working,
  onRename,
  onDelete,
  onRegenerate
}: ReportDetailViewProps): JSX.Element {
  const { report, sources } = detail
  const content = report.content
  const source = sources[0]
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(report.userTitle)

  useEffect(() => {
    setTitle(report.userTitle)
    setEditing(false)
  }, [report.id, report.userTitle])

  const saveTitle = async (): Promise<void> => {
    const normalized = title.trim()
    if (!normalized || normalized === report.userTitle) {
      setTitle(report.userTitle)
      setEditing(false)
      return
    }
    await onRename(normalized)
    setEditing(false)
  }

  return (
    <article className="rounded-md border bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex max-w-xl gap-2">
              <input
                value={title}
                maxLength={120}
                autoFocus
                onChange={(event) => setTitle(event.target.value)}
                className="min-w-0 flex-1 rounded-md border px-3 py-2 font-semibold"
              />
              <button
                type="button"
                disabled={working}
                onClick={() => void saveTitle()}
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                保存
              </button>
            </div>
          ) : (
            <h3 className="text-2xl font-semibold">{report.userTitle}</h3>
          )}
          <p className="mt-2 text-muted-foreground">{content.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={working}
            onClick={() => setEditing((value) => !value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {editing ? '取消改名' : '重命名'}
          </button>
          <button
            type="button"
            disabled={working || !source}
            onClick={onRegenerate}
            className="rounded-md border px-3 py-2 text-sm"
          >
            用相同来源重新生成
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() => void onDelete()}
            className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700"
          >
            删除报告
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-sky-200 bg-sky-50/60 p-4 text-sm text-sky-950">
        本报告基于收藏样本生成，只用于娱乐与自我回顾，不是心理测评、人格诊断或事实判断。
      </div>

      {source ? <SourceNotice detail={detail} /> : null}

      <section className="mt-6">
        <h4 className="text-lg font-semibold">口味速写</h4>
        <p className="mt-3 leading-7 text-muted-foreground">{content.tasteSnapshot.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {content.tasteSnapshot.keywords.map((keyword) => (
            <span key={keyword} className="rounded-full bg-muted px-3 py-1 text-sm">
              {keyword}
            </span>
          ))}
        </div>
        <Evidence
          evidence={content.tasteSnapshot.evidence ?? { songIds: [], factKeys: [] }}
          legacyMissing={!content.tasteSnapshot.evidence}
        />
      </section>

      <section className="mt-6 rounded-md border p-5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-lg font-semibold">{content.listeningArchetype.name}</h4>
          <Confidence value={content.listeningArchetype.confidence} />
        </div>
        <p className="mt-3 leading-7 text-muted-foreground">
          {content.listeningArchetype.description}
        </p>
        <Evidence evidence={content.listeningArchetype.evidence} />
      </section>

      <section className="mt-6">
        <h4 className="text-lg font-semibold">偏好维度</h4>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {content.dimensions.map((dimension) => (
            <div key={dimension.key} className="rounded-md border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h5 className="font-semibold">{dimension.title}</h5>
                  <p className="mt-1 text-sm font-medium text-primary">{dimension.tendency}</p>
                </div>
                <Confidence value={dimension.confidence} />
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {dimension.description}
              </p>
              <Evidence evidence={dimension.evidence} />
            </div>
          ))}
        </div>
      </section>

      <InsightSection title="可能的情绪与场景" insights={content.moodsAndScenes} />
      <InsightSection title="值得注意的样本模式" insights={content.notablePatterns} />
      <InsightSection title="娱乐性人格反思" insights={content.personalityReflections} />

      <section className="mt-6 rounded-md border border-amber-200 bg-amber-50/50 p-5">
        <h4 className="font-semibold">数据限制</h4>
        <ul className="mt-3 grid gap-2 text-sm text-amber-950">
          {content.limitations.map((limitation, index) => (
            <li key={`${index}-${limitation}`}>• {limitation}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6 border-t pt-5 text-xs text-muted-foreground">
        <p>
          模型：{report.modelId} · 服务：{report.providerOrigin} · Prompt v
          {report.promptTemplateVersion} · Content schema v{report.contentSchemaVersion}
        </p>
        <p className="mt-1 break-all">
          Dataset digest：{report.datasetDigest} · 生成时间：
          {new Date(report.generatedAt).toLocaleString()}
        </p>
      </section>
    </article>
  )
}

function SourceNotice({ detail }: { detail: AIReportDetail }): JSX.Element {
  const source = detail.sources[0]!
  const timeNotice =
    source.timePrecision === 'order_only'
      ? '当前来源缺少可靠收藏时间，“最近”按歌单或收藏顺序近似。'
      : source.timePrecision === 'mixed'
        ? '只有部分歌曲包含可靠时间，其余歌曲使用顺序补充。'
        : source.timePrecision === 'none'
          ? '当前来源没有可靠时间或顺序，本报告不会作收藏节奏判断。'
          : '本次样本使用来源中的收藏或加入时间排序。'

  return (
    <div className="mt-4 rounded-md bg-muted/50 p-4 text-sm">
      <p className="font-medium">
        来源：{source.sourceName} · 最近 {source.includedSongCount} 首
        {source.truncated ? `（本地共有 ${source.availableSongCount} 首）` : ''}
      </p>
      <p className="mt-1 text-muted-foreground">{timeNotice}</p>
    </div>
  )
}

function InsightSection({
  title,
  insights
}: {
  title: string
  insights: AIReportInsight[]
}): JSX.Element {
  return (
    <section className="mt-6">
      <h4 className="text-lg font-semibold">{title}</h4>
      {insights.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">当前样本不足以形成这一部分。</p>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {insights.map((insight, index) => (
            <div key={`${index}-${insight.title}`} className="rounded-md border p-4">
              <div className="flex items-start justify-between gap-3">
                <h5 className="font-semibold">{insight.title}</h5>
                <Confidence value={insight.confidence} />
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{insight.description}</p>
              <Evidence evidence={insight.evidence} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Evidence({
  evidence,
  legacyMissing = false
}: {
  evidence: AIReportEvidence
  legacyMissing?: boolean
}): JSX.Element {
  if (evidence.songIds.length === 0 && evidence.factKeys.length === 0) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        {legacyMissing ? '这份旧版报告未为此章节保存独立证据。' : '当前解释没有足够的可引用证据。'}
      </p>
    )
  }
  return (
    <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
      {evidence.factKeys.length > 0 ? <p>事实字段：{evidence.factKeys.join(' · ')}</p> : null}
      {evidence.songIds.length > 0 ? (
        <p className="mt-1 break-all">样本歌曲 ID：{evidence.songIds.join(' · ')}</p>
      ) : null}
    </div>
  )
}

function Confidence({ value }: { value: 'low' | 'medium' | 'high' }): JSX.Element {
  const label = value === 'high' ? '高置信' : value === 'medium' ? '中置信' : '低置信'
  return <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs">{label}</span>
}
