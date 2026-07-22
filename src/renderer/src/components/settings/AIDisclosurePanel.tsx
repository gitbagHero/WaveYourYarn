import { useCallback, useEffect, useState } from 'react'
import { aiDisclosureApi } from '../../api/aiDisclosureApi'
import { llmProfilesApi } from '../../api/llmProfilesApi'
import { statisticsApi } from '../../api/statisticsApi'
import type {
  AIDisclosureAuthorization,
  AIDisclosurePreferences,
  AIDisclosurePreview,
  AIDisclosureSourceRequest,
  PublicLLMProfile
} from '../../types/llm'
import type { StatisticsSourceInfo } from '../../types/statistics'

export function AIDisclosurePanel(): JSX.Element {
  const [profiles, setProfiles] = useState<PublicLLMProfile[]>([])
  const [sources, setSources] = useState<StatisticsSourceInfo[]>([])
  const [preferences, setPreferences] = useState<AIDisclosurePreferences | null>(null)
  const [profileId, setProfileId] = useState('')
  const [sourceKey, setSourceKey] = useState('liked')
  const [preview, setPreview] = useState<AIDisclosurePreview | null>(null)
  const [authorization, setAuthorization] = useState<AIDisclosureAuthorization | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    const [profilesResult, preferencesResult, sourcesResult] = await Promise.all([
      llmProfilesApi.list(),
      aiDisclosureApi.getPreferences(),
      statisticsApi.getSources().catch(() => null)
    ])

    if (profilesResult.success) {
      const nextProfiles = profilesResult.data ?? []
      setProfiles(nextProfiles)
      setProfileId((current) =>
        nextProfiles.some(({ id }) => id === current)
          ? current
          : (nextProfiles.find(({ isActive }) => isActive)?.id ?? nextProfiles[0]?.id ?? '')
      )
    } else {
      setError(profilesResult.message ?? '读取模型配置失败')
    }
    if (preferencesResult.success && preferencesResult.data) {
      setPreferences(preferencesResult.data)
    } else {
      setError(preferencesResult.message ?? '读取数据披露设置失败')
    }
    if (sourcesResult) {
      setSources(sourcesResult)
      setSourceKey((current) =>
        sourcesResult.some((source) => sourceToKey(source) === current)
          ? current
          : sourcesResult[0]
            ? sourceToKey(sourcesResult[0])
            : 'liked'
      )
    } else {
      setError('读取本地音乐数据来源失败')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const changeMode = async (
    confirmationMode: AIDisclosurePreferences['confirmationMode']
  ): Promise<void> => {
    setWorking(true)
    setError(null)
    const result = await aiDisclosureApi.setPreferences(confirmationMode)
    if (result.success && result.data) {
      setPreferences(result.data)
      setRemember(false)
      setPreview(null)
      setAuthorization(null)
      setMessage('数据披露确认模式已更新')
    } else {
      setError(result.message ?? '更新数据披露设置失败')
    }
    setWorking(false)
  }

  const revokeRemembered = async (): Promise<void> => {
    if (!window.confirm('确认撤销所有已记住的 AI 数据披露授权吗？')) {
      return
    }
    setWorking(true)
    setError(null)
    const result = await aiDisclosureApi.revokeRemembered()
    if (result.success && result.data) {
      setPreferences(result.data)
      setPreview(null)
      setAuthorization(null)
      setMessage('所有已记住的数据披露授权均已撤销')
    } else {
      setError(result.message ?? '撤销数据披露授权失败')
    }
    setWorking(false)
  }

  const createPreview = async (): Promise<void> => {
    if (!profileId) {
      return
    }
    setWorking(true)
    setError(null)
    setMessage(null)
    setAuthorization(null)
    setConfirmed(false)
    setRemember(false)
    const result = await aiDisclosureApi.preview({
      profileId,
      source: keyToSource(sourceKey)
    })
    if (result.success && result.data) {
      setPreview(result.data)
    } else {
      setPreview(null)
      setError(result.message ?? '生成数据披露预览失败')
    }
    setWorking(false)
  }

  const authorize = async (): Promise<void> => {
    if (!preview) {
      return
    }
    setWorking(true)
    setError(null)
    const result = await aiDisclosureApi.authorize({
      previewId: preview.previewId,
      confirmed: preview.requiresConfirmation ? confirmed : false,
      remember: preview.requiresConfirmation ? remember : false
    })
    if (result.success && result.data) {
      setAuthorization(result.data)
      setMessage('本次披露授权已准备；此操作本身不会上传任何音乐数据')
      if (result.data.remembered) {
        const preferencesResult = await aiDisclosureApi.getPreferences()
        if (preferencesResult.success && preferencesResult.data) {
          setPreferences(preferencesResult.data)
        }
      }
    } else {
      setError(result.message ?? '确认数据披露失败')
    }
    setWorking(false)
  }

  return (
    <section className="mt-6 rounded-md border bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold">AI 数据披露</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          在任何音乐数据发送前，先核对目标服务、歌曲数量与字段。本预览和确认流程不会自行发起模型请求。
        </p>
      </div>

      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {message ? (
        <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p>
      ) : null}

      {loading ? <p className="mt-5 text-sm text-muted-foreground">正在读取披露设置...</p> : null}
      {!loading && preferences ? (
        <div className="mt-5 grid gap-4">
          <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
            <label className="grid min-w-64 gap-1.5 text-sm">
              <span className="font-medium">生成报告前的确认方式</span>
              <select
                value={preferences.confirmationMode}
                disabled={working}
                onChange={(event) =>
                  void changeMode(event.target.value as AIDisclosurePreferences['confirmationMode'])
                }
                className="rounded-md border px-3 py-2"
              >
                <option value="allow_remembered">每次确认，可记住同范围授权</option>
                <option value="always">始终要求每次确认</option>
              </select>
            </label>
            <button
              type="button"
              disabled={working || preferences.rememberedConsentCount === 0}
              onClick={() => void revokeRemembered()}
              className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              撤销已记住授权（{preferences.rememberedConsentCount}）
            </button>
          </div>

          <div className="grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">模型配置</span>
              <select
                value={profileId}
                onChange={(event) => setProfileId(event.target.value)}
                className="rounded-md border px-3 py-2"
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                    {profile.isActive ? '（当前）' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">本地音乐来源</span>
              <select
                value={sourceKey}
                onChange={(event) => setSourceKey(event.target.value)}
                className="rounded-md border px-3 py-2"
              >
                {sources.map((source) => (
                  <option key={sourceToKey(source)} value={sourceToKey(source)}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={working || !profileId || sources.length === 0}
              onClick={() => void createPreview()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? '处理中...' : '生成披露预览'}
            </button>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50/40 p-4 text-sm">
          <h3 className="font-semibold">本次可能发送的数据</h3>
          <dl className="mt-3 grid gap-2 md:grid-cols-2">
            <PreviewItem
              label="配置 / 模型"
              value={`${preview.profile.name} / ${preview.profile.modelId}`}
            />
            <PreviewItem label="目标域名" value={preview.targetOrigin} />
            <PreviewItem label="音乐来源" value={preview.source.name} />
            <PreviewItem
              label="歌曲数量"
              value={`${preview.songCount} 首（配置上限 ${preview.maximumSongCount} 首）`}
            />
            <PreviewItem label="包含昵称" value="否" />
            <PreviewItem
              label="确认状态"
              value={preview.matchedRememberedConsent ? '匹配已记住授权' : '需要本次明确确认'}
            />
          </dl>
          <div className="mt-4">
            <p className="font-medium">字段清单</p>
            <ul className="mt-2 grid gap-1 text-muted-foreground md:grid-cols-2">
              {preview.fields.map((field) => (
                <li key={field.path}>• {field.label}</li>
              ))}
            </ul>
          </div>
          <ul className="mt-4 grid gap-1 text-amber-900">
            {preview.notices.map((notice) => (
              <li key={notice}>• {notice}</li>
            ))}
          </ul>

          {!authorization ? (
            <div className="mt-4 grid gap-3 border-t border-amber-200 pt-4">
              {preview.requiresConfirmation ? (
                <>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>我已核对以上目标、数量和字段，并理解数据发送后无法由本应用撤回。</span>
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
                      <span>
                        记住完全相同范围的授权；目标、协议、来源、字段或数量扩大时重新确认。
                      </span>
                    </label>
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground">
                  当前范围与已记住的授权完全匹配；仍需由你点击后才会准备单次授权。
                </p>
              )}
              <button
                type="button"
                disabled={working || (preview.requiresConfirmation && !confirmed)}
                onClick={() => void authorize()}
                className="w-fit rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                准备本次单次授权
              </button>
            </div>
          ) : (
            <p className="mt-4 border-t border-amber-200 pt-4 font-medium text-green-700">
              单次授权已创建，将于 {new Date(authorization.expiresAt).toLocaleTimeString()}{' '}
              失效；本版本不会自动上传数据。
            </p>
          )}
        </div>
      ) : null}
    </section>
  )
}

function sourceToKey(source: StatisticsSourceInfo): string {
  return source.type === 'playlist' ? `playlist:${source.id ?? ''}` : source.type
}

function keyToSource(key: string): AIDisclosureSourceRequest {
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
