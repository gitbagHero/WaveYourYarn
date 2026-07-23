import { useEffect, useMemo, useState } from 'react'
import { aiDisclosureApi } from '../../api/aiDisclosureApi'
import { aiReportsApi } from '../../api/aiReportsApi'
import { llmJobsApi } from '../../api/llmJobsApi'
import type { AIReportDetail } from '../../types/aiReport'
import type {
  AIDisclosurePreferences,
  AIDisclosurePreview,
  AIDisclosureSourceRequest,
  JobRun,
  PublicLLMProfile
} from '../../types/llm'
import type { StatisticsSourceInfo } from '../../types/statistics'

const POLL_INTERVAL_MS = 800

export interface ReportRegenerationIntent {
  key: number
  profileId?: string
  source: AIDisclosureSourceRequest
}

interface ReportGenerationPanelProps {
  profiles: PublicLLMProfile[]
  sources: StatisticsSourceInfo[]
  regenerationIntent?: ReportRegenerationIntent
  onGenerated: (detail: AIReportDetail) => void
}

export function ReportGenerationPanel({
  profiles,
  sources,
  regenerationIntent,
  onGenerated
}: ReportGenerationPanelProps): JSX.Element {
  const [profileId, setProfileId] = useState('')
  const [sourceKey, setSourceKey] = useState('liked')
  const [preferences, setPreferences] = useState<AIDisclosurePreferences | null>(null)
  const [songLimit, setSongLimit] = useState(100)
  const [language, setLanguage] = useState('zh-CN')
  const [preview, setPreview] = useState<AIDisclosurePreview | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [remember, setRemember] = useState(false)
  const [job, setJob] = useState<JobRun | null>(null)
  const [retryOfJobId, setRetryOfJobId] = useState<string | undefined>()
  const [resolvedJobId, setResolvedJobId] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const jobId = job?.id
  const jobStatus = job?.status
  const selectedProfile = useMemo(
    () => profiles.find(({ id }) => id === profileId),
    [profileId, profiles]
  )
  const optionsValid = Boolean(
    selectedProfile &&
    Number.isInteger(songLimit) &&
    songLimit >= 1 &&
    songLimit <= selectedProfile.maxInputSongs &&
    language.trim() &&
    language.trim().length <= 32
  )

  useEffect(() => {
    setProfileId((current) =>
      profiles.some(({ id }) => id === current)
        ? current
        : (profiles.find(({ isActive }) => isActive)?.id ?? profiles[0]?.id ?? '')
    )
  }, [profiles])

  useEffect(() => {
    if (selectedProfile) {
      setSongLimit(selectedProfile.maxInputSongs)
      setLanguage(selectedProfile.language)
    }
  }, [selectedProfile])

  useEffect(() => {
    setSourceKey((current) =>
      sources.some((source) => sourceToKey(source) === current)
        ? current
        : sources[0]
          ? sourceToKey(sources[0])
          : 'liked'
    )
  }, [sources])

  useEffect(() => {
    void aiDisclosureApi.getPreferences().then((result) => {
      if (result.success && result.data) {
        setPreferences(result.data)
      }
    })
  }, [])

  useEffect(() => {
    if (!regenerationIntent) {
      return
    }
    if (
      regenerationIntent.profileId &&
      profiles.some(({ id }) => id === regenerationIntent.profileId)
    ) {
      setProfileId(regenerationIntent.profileId)
    }
    setSourceKey(requestSourceToKey(regenerationIntent.source))
    resetFlow()
  }, [regenerationIntent, profiles])

  useEffect(() => {
    if (!jobId || !jobStatus || !['pending', 'running'].includes(jobStatus)) {
      return
    }
    let active = true
    const poll = async (): Promise<void> => {
      const result = await llmJobsApi.get({ id: jobId })
      if (active && result.success && result.data) {
        setJob(result.data)
      }
    }
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS)
    void poll()
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [jobId, jobStatus])

  useEffect(() => {
    if (!job || job.status !== 'succeeded' || resolvedJobId === job.id) {
      return
    }
    setResolvedJobId(job.id)
    void aiReportsApi.getByJob({ jobId: job.id }).then((result) => {
      if (result.success && result.data) {
        onGenerated(result.data)
        setPreview(null)
        setRetryOfJobId(undefined)
      } else {
        setError(result.message ?? '报告已生成，但读取本地报告失败')
      }
    })
  }, [job, onGenerated, resolvedJobId])

  const terminalFailure = job && ['failed', 'cancelled', 'interrupted'].includes(job.status)

  const changeProfile = (value: string): void => {
    setProfileId(value)
    resetFlow()
  }

  const changeSource = (value: string): void => {
    setSourceKey(value)
    resetFlow()
  }

  const createPreview = async (): Promise<void> => {
    if (!profileId) {
      return
    }
    setWorking(true)
    setError(null)
    setPreview(null)
    setConfirmed(false)
    setRemember(false)
    const result = await aiDisclosureApi.preview({
      profileId,
      source: keyToRequestSource(sourceKey),
      requestedSongLimit: songLimit,
      language: language.trim()
    })
    if (result.success && result.data) {
      setPreview(result.data)
    } else {
      setError(result.message ?? '无法生成数据披露预览')
    }
    setWorking(false)
  }

  const authorizeAndStart = async (): Promise<void> => {
    if (!preview) {
      return
    }
    setWorking(true)
    setError(null)
    const authorization = await aiDisclosureApi.authorize({
      previewId: preview.previewId,
      confirmed: preview.requiresConfirmation ? confirmed : false,
      remember: preview.requiresConfirmation ? remember : false
    })
    if (!authorization.success || !authorization.data) {
      setError(authorization.message ?? '数据披露授权失败，请重新预览')
      setWorking(false)
      return
    }

    const started = await aiReportsApi.start({
      profileId,
      source: keyToRequestSource(sourceKey),
      authorizationToken: authorization.data.token,
      requestedSongLimit: songLimit,
      language: language.trim(),
      ...(retryOfJobId ? { retryOfJobId } : {})
    })
    if (started.success && started.data) {
      setJob(started.data)
      setResolvedJobId(null)
    } else {
      setError(started.message ?? '启动 AI 报告生成失败')
      setPreview(null)
    }
    setWorking(false)
  }

  const cancel = async (): Promise<void> => {
    if (!job) {
      return
    }
    const result = await llmJobsApi.cancel({ id: job.id })
    if (!result.success) {
      setError(result.message ?? '取消任务失败')
    }
  }

  const prepareRetry = (): void => {
    if (!job) {
      return
    }
    setRetryOfJobId(job.id)
    setJob(null)
    setPreview(null)
    setConfirmed(false)
    setRemember(false)
    setError(null)
  }

  function resetFlow(): void {
    setPreview(null)
    setJob(null)
    setRetryOfJobId(undefined)
    setResolvedJobId(null)
    setConfirmed(false)
    setRemember(false)
    setError(null)
  }

  return (
    <section id="ai-report-generator" className="rounded-md border bg-white p-6">
      <div>
        <h3 className="text-lg font-semibold">生成新的音乐偏好报告</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          只读取本地缓存中最近的歌曲样本。开始前会明确展示发送目标、歌曲数量和字段。
        </p>
      </div>

      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_10rem_10rem_auto] xl:items-end">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">模型配置</span>
          <select
            value={profileId}
            disabled={working || Boolean(job && ['pending', 'running'].includes(job.status))}
            onChange={(event) => changeProfile(event.target.value)}
            className="rounded-md border px-3 py-2"
          >
            {profiles.length === 0 ? <option value="">请先在设置中添加模型配置</option> : null}
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} / {profile.modelId}
                {profile.isActive ? '（当前）' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">本地音乐来源</span>
          <select
            value={sourceKey}
            disabled={working || Boolean(job && ['pending', 'running'].includes(job.status))}
            onChange={(event) => changeSource(event.target.value)}
            className="rounded-md border px-3 py-2"
          >
            {sources.length === 0 ? <option value="">暂无已同步数据来源</option> : null}
            {sources.map((source) => (
              <option key={sourceToKey(source)} value={sourceToKey(source)}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">分析歌曲数</span>
          <input
            type="number"
            min={1}
            max={selectedProfile?.maxInputSongs ?? 100}
            value={songLimit}
            disabled={working || Boolean(job && ['pending', 'running'].includes(job.status))}
            onChange={(event) => {
              setSongLimit(Number(event.target.value))
              resetFlow()
            }}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">报告语言</span>
          <input
            value={language}
            maxLength={32}
            disabled={working || Boolean(job && ['pending', 'running'].includes(job.status))}
            onChange={(event) => {
              setLanguage(event.target.value)
              resetFlow()
            }}
            placeholder="zh-CN"
            className="rounded-md border px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={
            working ||
            !selectedProfile?.hasApiKey ||
            !optionsValid ||
            sources.length === 0 ||
            Boolean(job && ['pending', 'running'].includes(job.status))
          }
          onClick={() => void createPreview()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {working ? '处理中...' : retryOfJobId ? '重新预览后重试' : '查看发送内容'}
        </button>
      </div>

      {selectedProfile ? (
        <p className="mt-3 text-xs text-muted-foreground">
          当前配置允许最多最近 {selectedProfile.maxInputSongs} 首 · 请求超时{' '}
          {Math.round(selectedProfile.timeoutMs / 1000)} 秒
          {!selectedProfile.hasApiKey ? ' · 尚未保存 API Key' : ''}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50/50 p-4 text-sm">
          <h4 className="font-semibold">发送前最后确认</h4>
          <dl className="mt-3 grid gap-3 md:grid-cols-2">
            <PreviewItem label="目标服务" value={preview.targetOrigin} />
            <PreviewItem
              label="模型"
              value={`${preview.profile.name} / ${preview.profile.modelId}`}
            />
            <PreviewItem label="来源" value={preview.source.name} />
            <PreviewItem
              label="歌曲数量"
              value={`${preview.songCount} 首（上限 ${preview.maximumSongCount} 首）`}
            />
            <PreviewItem label="报告语言" value={preview.reportLanguage} />
          </dl>
          <div className="mt-4">
            <p className="font-medium">将发送的字段</p>
            <ul className="mt-2 grid gap-1 text-muted-foreground md:grid-cols-2">
              {preview.fields.map((field) => (
                <li key={field.path}>• {field.label}</li>
              ))}
            </ul>
          </div>
          <ul className="mt-4 grid gap-1 text-amber-900">
            {preview.notices.slice(0, 3).map((notice) => (
              <li key={notice}>• {notice}</li>
            ))}
          </ul>

          {preview.requiresConfirmation ? (
            <div className="mt-4 grid gap-3 border-t border-amber-200 pt-4">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-0.5"
                />
                <span>我已核对发送目标、数量和字段，并理解远端收到数据后无法由本应用撤回。</span>
              </label>
              {preferences?.confirmationMode === 'allow_remembered' ? (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={remember}
                    disabled={!confirmed}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>记住完全相同范围的授权；范围变化后仍会重新确认。</span>
                </label>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 border-t border-amber-200 pt-4 text-muted-foreground">
              本次范围与已记住授权完全一致。仍需点击下方按钮才会发送数据。
            </p>
          )}
          <button
            type="button"
            disabled={
              working ||
              Boolean(job && ['pending', 'running'].includes(job.status)) ||
              (preview.requiresConfirmation && !confirmed)
            }
            onClick={() => void authorizeAndStart()}
            className="mt-4 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working ? '正在启动...' : retryOfJobId ? '确认发送并重试' : '确认发送并生成报告'}
          </button>
        </div>
      ) : null}

      {job ? (
        <div className="mt-5 rounded-md border p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{jobStatusLabel(job)}</p>
              <p className="mt-1 text-muted-foreground">
                阶段：{stageLabel(job.stage)}
                {job.progressTotal !== undefined
                  ? ` · ${job.progressCurrent ?? 0}/${job.progressTotal}`
                  : ''}
              </p>
            </div>
            {['pending', 'running'].includes(job.status) ? (
              <button
                type="button"
                onClick={() => void cancel()}
                className="rounded-md border border-red-200 px-3 py-2 text-red-700"
              >
                取消任务
              </button>
            ) : null}
          </div>
          {job.progressTotal ? (
            <div className="mt-3 h-2 overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-primary transition-all"
                style={{ width: `${((job.progressCurrent ?? 0) / job.progressTotal) * 100}%` }}
              />
            </div>
          ) : null}
          {terminalFailure ? (
            <div className="mt-3">
              <p className="text-red-700">{job.safeMessage ?? '报告生成未完成'}</p>
              <button
                type="button"
                onClick={prepareRetry}
                className="mt-3 rounded-md border px-3 py-2 font-medium"
              >
                重新授权并重试
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function sourceToKey(source: StatisticsSourceInfo): string {
  return source.type === 'playlist' ? `playlist:${source.id ?? ''}` : source.type
}

function requestSourceToKey(source: AIDisclosureSourceRequest): string {
  return source.type === 'playlist' ? `playlist:${source.playlistId ?? ''}` : source.type
}

function keyToRequestSource(key: string): AIDisclosureSourceRequest {
  if (key === 'liked' || key === 'all') {
    return { type: key }
  }
  return { type: 'playlist', playlistId: key.slice('playlist:'.length) }
}

function PreviewItem({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all font-medium">{value}</dd>
    </div>
  )
}

function jobStatusLabel(job: JobRun): string {
  const labels: Record<JobRun['status'], string> = {
    pending: '报告任务正在排队',
    running: '正在生成 AI 音乐报告',
    succeeded: '报告已生成并安全保存',
    failed: '报告生成失败',
    cancelled: '报告任务已取消',
    interrupted: '报告任务因应用退出而中断'
  }
  return labels[job.status]
}

function stageLabel(stage: string): string {
  return (
    {
      queued: '等待开始',
      starting: '准备任务',
      building_prompt: '整理本地事实',
      requesting: '等待模型响应',
      validating: '校验报告证据',
      persisting: '保存本地报告',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
      interrupted: '已中断'
    }[stage] ?? stage
  )
}
