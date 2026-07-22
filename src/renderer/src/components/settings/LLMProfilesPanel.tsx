import { useCallback, useEffect, useMemo, useState } from 'react'
import { llmJobsApi } from '../../api/llmJobsApi'
import { llmProfilesApi } from '../../api/llmProfilesApi'
import type {
  CreateLLMProfileRequest,
  JobRun,
  LLMOutputMode,
  LLMProtocol,
  LLMProtocolOption,
  PublicLLMProfile
} from '../../types/llm'

const EMPTY_FORM: CreateLLMProfileRequest = {
  name: '',
  protocol: 'openai_chat_completions',
  baseUrl: '',
  modelId: '',
  timeoutMs: 180_000,
  outputMode: 'json_object',
  language: 'zh-CN',
  maxInputSongs: 100
}

export function LLMProfilesPanel(): JSX.Element {
  const [profiles, setProfiles] = useState<PublicLLMProfile[]>([])
  const [protocolOptions, setProtocolOptions] = useState<LLMProtocolOption[]>([])
  const [form, setForm] = useState<CreateLLMProfileRequest>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [keyProfileId, setKeyProfileId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionJobs, setConnectionJobs] = useState<Record<string, JobRun>>({})
  const runningJobKey = useMemo(
    () =>
      Object.values(connectionJobs)
        .filter((job) => ['pending', 'running'].includes(job.status))
        .map((job) => job.id)
        .sort()
        .join('\n'),
    [connectionJobs]
  )

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    const [profilesResult, optionsResult] = await Promise.all([
      llmProfilesApi.list(),
      llmProfilesApi.getProtocolOptions()
    ])

    if (profilesResult.success) {
      setProfiles(profilesResult.data ?? [])
    } else {
      setError(profilesResult.message ?? '读取模型配置失败')
    }
    if (optionsResult.success) {
      setProtocolOptions(optionsResult.data ?? [])
    } else {
      setError(optionsResult.message ?? '读取模型协议失败')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!runningJobKey) {
      return
    }
    const runningJobIds = runningJobKey.split('\n')

    let stopped = false
    const poll = async (): Promise<void> => {
      const results = await Promise.all(runningJobIds.map((id) => llmJobsApi.get({ id })))
      if (stopped) {
        return
      }
      let completed = false
      setConnectionJobs((current) => {
        const next = { ...current }
        results.forEach((result) => {
          if (result.success && result.data?.profileId) {
            next[result.data.profileId] = result.data
            completed ||= !['pending', 'running'].includes(result.data.status)
          }
        })
        return next
      })
      if (completed) {
        await load()
      }
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 750)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [runningJobKey, load])

  const selectedProtocol = useMemo(
    () => protocolOptions.find((option) => option.protocol === form.protocol),
    [form.protocol, protocolOptions]
  )

  const resetForm = (): void => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  const startCreate = (): void => {
    setError(null)
    setMessage(null)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const startEdit = (profile: PublicLLMProfile): void => {
    setError(null)
    setMessage(null)
    setEditingId(profile.id)
    setForm({
      name: profile.name,
      protocol: profile.protocol,
      baseUrl: profile.baseUrl,
      modelId: profile.modelId,
      timeoutMs: profile.timeoutMs,
      outputMode: profile.outputMode,
      language: profile.language,
      maxInputSongs: profile.maxInputSongs
    })
    setShowForm(true)
  }

  const submitProfile = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const result = editingId
      ? await llmProfilesApi.update({ id: editingId, changes: form })
      : await llmProfilesApi.create(form)
    if (result.success) {
      setMessage(editingId ? '模型配置已更新' : '模型配置已创建，请继续设置 API Key')
      resetForm()
      await load()
    } else {
      setError(result.message ?? '保存模型配置失败')
    }
    setSaving(false)
  }

  const activateProfile = async (id: string): Promise<void> => {
    setError(null)
    const result = await llmProfilesApi.setActive({ id })
    if (result.success) {
      setMessage('活动模型配置已切换')
      await load()
    } else {
      setError(result.message ?? '切换模型配置失败')
    }
  }

  const removeProfile = async (profile: PublicLLMProfile): Promise<void> => {
    if (
      !window.confirm(`确认删除模型配置“${profile.name}”吗？对应 API Key 也会从系统安全存储移除。`)
    ) {
      return
    }
    setError(null)
    const result = await llmProfilesApi.delete({ id: profile.id })
    if (result.success) {
      setMessage('模型配置已删除')
      await load()
    } else {
      setError(result.message ?? '删除模型配置失败')
    }
  }

  const saveApiKey = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!keyProfileId) {
      return
    }
    setSaving(true)
    setError(null)
    const result = await llmProfilesApi.setApiKey({ id: keyProfileId, apiKey })
    setApiKey('')
    if (result.success) {
      setKeyProfileId(null)
      setMessage('API Key 已保存到系统安全存储')
      await load()
    } else {
      setError(result.message ?? '保存 API Key 失败')
    }
    setSaving(false)
  }

  const removeApiKey = async (profile: PublicLLMProfile): Promise<void> => {
    if (!window.confirm(`确认移除“${profile.name}”保存的 API Key 吗？`)) {
      return
    }
    setError(null)
    const result = await llmProfilesApi.deleteApiKey({ id: profile.id })
    if (result.success) {
      setMessage('API Key 已移除')
      await load()
    } else {
      setError(result.message ?? '移除 API Key 失败')
    }
  }

  const testConnection = async (profile: PublicLLMProfile): Promise<void> => {
    setError(null)
    setMessage(null)
    const result = await llmProfilesApi.testConnection({ id: profile.id })
    if (result.success && result.data) {
      setConnectionJobs((current) => ({ ...current, [profile.id]: result.data! }))
      setMessage('连接测试已启动；固定测试请求不会发送音乐数据')
    } else {
      setError(result.message ?? '启动连接测试失败')
    }
  }

  const cancelConnectionTest = async (job: JobRun): Promise<void> => {
    const result = await llmJobsApi.cancel({ id: job.id })
    if (!result.success) {
      setError(result.message ?? '取消连接测试失败')
    }
  }

  return (
    <section className="mt-6 rounded-md border bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">AI 模型配置</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            配置兼容接口与模型。API Key 仅保存到系统安全存储，不会显示、导出或写入报告。
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          添加 API 配置
        </button>
      </div>

      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {message ? (
        <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p>
      ) : null}

      {loading ? <p className="mt-5 text-sm text-muted-foreground">正在读取模型配置...</p> : null}
      {!loading && profiles.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          尚未添加模型配置。应用不会内置厂商、模型或 API Key。
        </div>
      ) : null}

      <div className="mt-5 grid gap-4">
        {profiles.map((profile) => (
          <article key={profile.id} className="rounded-md border p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{profile.name}</h3>
                  {profile.isActive ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      当前使用
                    </span>
                  ) : null}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {profile.hasApiKey ? '已保存 Key' : '未保存 Key'}
                  </span>
                </div>
                <dl className="mt-3 grid gap-1 text-sm text-muted-foreground">
                  <div>
                    <dt className="inline">模型：</dt>
                    <dd className="inline break-all">{profile.modelId}</dd>
                  </div>
                  <div>
                    <dt className="inline">地址：</dt>
                    <dd className="inline break-all">{profile.baseUrl}</dd>
                  </div>
                  <div>
                    <dt className="inline">输出：</dt>
                    <dd className="inline">{profile.outputMode}</dd>
                  </div>
                  <div>
                    <dt className="inline">连接状态：</dt>
                    <dd className="inline">
                      {connectionStatusLabel(connectionJobs[profile.id], profile)}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!profile.hasApiKey || isJobRunning(connectionJobs[profile.id])}
                  title={profile.hasApiKey ? undefined : '请先设置 API Key'}
                  className="rounded-md border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void testConnection(profile)}
                >
                  {isJobRunning(connectionJobs[profile.id]) ? '测试中...' : '测试连接'}
                </button>
                {isJobRunning(connectionJobs[profile.id]) ? (
                  <button
                    type="button"
                    className="rounded-md border px-3 py-1.5 text-sm"
                    onClick={() => void cancelConnectionTest(connectionJobs[profile.id]!)}
                  >
                    取消测试
                  </button>
                ) : null}
                {!profile.isActive ? (
                  <button
                    type="button"
                    className="rounded-md border px-3 py-1.5 text-sm"
                    onClick={() => void activateProfile(profile.id)}
                  >
                    设为当前
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-md border px-3 py-1.5 text-sm"
                  onClick={() => startEdit(profile)}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="rounded-md border px-3 py-1.5 text-sm"
                  onClick={() => {
                    setApiKey('')
                    setKeyProfileId(profile.id)
                  }}
                >
                  {profile.hasApiKey ? '更换 Key' : '设置 Key'}
                </button>
                {profile.hasApiKey ? (
                  <button
                    type="button"
                    className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700"
                    onClick={() => void removeApiKey(profile)}
                  >
                    移除 Key
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700"
                  onClick={() => void removeProfile(profile)}
                >
                  删除
                </button>
              </div>
            </div>

            {keyProfileId === profile.id ? (
              <form
                className="mt-4 flex flex-wrap gap-3 border-t pt-4"
                onSubmit={(event) => void saveApiKey(event)}
              >
                <input
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="输入新的 API Key"
                  required
                  className="min-w-72 flex-1 rounded-md border px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  保存 Key
                </button>
                <button
                  type="button"
                  className="rounded-md border px-4 py-2 text-sm"
                  onClick={() => {
                    setApiKey('')
                    setKeyProfileId(null)
                  }}
                >
                  取消
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </div>

      {showForm ? (
        <form
          className="mt-6 grid gap-4 rounded-md border bg-muted/20 p-4"
          onSubmit={(event) => void submitProfile(event)}
        >
          <h3 className="font-semibold">{editingId ? '编辑模型配置' : '添加模型配置'}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="配置名称">
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </Field>
            <Field label="模型 ID">
              <input
                required
                value={form.modelId}
                onChange={(event) => setForm({ ...form, modelId: event.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Base URL">
              <input
                required
                type="url"
                value={form.baseUrl}
                onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
                placeholder="https://example.com/v1"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </Field>
            <Field label="接口协议">
              <select
                value={form.protocol}
                onChange={(event) => {
                  const protocol = event.target.value as LLMProtocol
                  const option = protocolOptions.find((item) => item.protocol === protocol)
                  setForm({
                    ...form,
                    protocol,
                    outputMode: option?.outputModes[0] ?? 'json_object'
                  })
                }}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {protocolOptions.map((option) => (
                  <option key={option.protocol} value={option.protocol}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="输出模式">
              <select
                value={form.outputMode}
                onChange={(event) =>
                  setForm({ ...form, outputMode: event.target.value as LLMOutputMode })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {(selectedProtocol?.outputModes ?? ['json_object']).map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="报告语言">
              <input
                required
                value={form.language}
                onChange={(event) => setForm({ ...form, language: event.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </Field>
            <Field label="请求超时（秒）">
              <input
                required
                type="number"
                min={1}
                max={900}
                value={Math.round(form.timeoutMs / 1000)}
                onChange={(event) =>
                  setForm({ ...form, timeoutMs: Number(event.target.value) * 1000 })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </Field>
            <Field label="最多分析歌曲数">
              <input
                required
                type="number"
                min={1}
                max={100}
                value={form.maxInputSongs}
                onChange={(event) =>
                  setForm({ ...form, maxInputSongs: Number(event.target.value) })
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            公网地址必须使用 HTTPS；本机调试仅允许 localhost、127.0.0.1 或
            ::1。当前最多分析最近100首。
          </p>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving ? '正在保存...' : '保存配置'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border px-4 py-2 text-sm"
            >
              取消
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

function isJobRunning(job: JobRun | undefined): boolean {
  return Boolean(job && ['pending', 'running'].includes(job.status))
}

function connectionStatusLabel(job: JobRun | undefined, profile: PublicLLMProfile): string {
  if (!job) {
    if (profile.lastTestStatus === 'succeeded') {
      return '上次测试成功'
    }
    if (profile.lastTestStatus === 'failed') {
      return '上次测试失败'
    }
    return '尚未测试'
  }

  switch (job.status) {
    case 'pending':
      return '等待测试'
    case 'running':
      return '正在测试'
    case 'succeeded':
      return '测试成功'
    case 'failed':
      return job.safeMessage ? `测试失败：${job.safeMessage}` : '测试失败'
    case 'cancelled':
      return '测试已取消'
    case 'interrupted':
      return '测试因应用退出而中断'
  }
}
