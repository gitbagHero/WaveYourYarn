import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorState } from '../components/common/ErrorState'
import { PageHeader } from '../components/common/PageHeader'
import { useAuthStore } from '../stores/authStore'

type WebLoginStatus = 'idle' | 'opening' | 'waiting' | 'verifying' | 'success' | 'failed'

const webLoginStatusText: Record<WebLoginStatus, string> = {
  idle: '准备连接网易云音乐',
  opening: '正在打开登录窗口',
  waiting: '请在弹出的网易云网页中完成登录',
  verifying: '正在验证登录状态',
  success: '登录成功',
  failed: '登录失败，请重试'
}

export function LoginPage(): JSX.Element {
  const navigate = useNavigate()
  const { openWebLogin, loginWithCookie, loading, error } = useAuthStore()
  const [status, setStatus] = useState<WebLoginStatus>('idle')
  const [manualCookie, setManualCookie] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  const handleOpenWebLogin = async (): Promise<void> => {
    setStatus('opening')
    setManualError(null)

    window.setTimeout(() => {
      setStatus((current) => (current === 'opening' ? 'waiting' : current))
    }, 500)

    await openWebLogin()
    const latest = useAuthStore.getState()

    if (latest.isLoggedIn) {
      setStatus('success')
      window.setTimeout(() => navigate('/'), 600)
      return
    }

    setStatus('failed')
  }

  const handleCookieLogin = async (): Promise<void> => {
    setManualError(null)
    await loginWithCookie(manualCookie)
    const latest = useAuthStore.getState()

    if (latest.isLoggedIn) {
      setStatus('success')
      window.setTimeout(() => navigate('/'), 600)
      return
    }

    setManualError(latest.error ?? 'Cookie 无效或已过期，请重新获取')
  }

  return (
    <div>
      <PageHeader
        title="连接网易云音乐"
        description="使用网易云官方网页登录，WaveYourYarn 会在本机读取登录状态。"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-md border bg-white p-6">
          <div>
            <span className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">推荐</span>
            <h3 className="mt-4 text-xl font-semibold">使用网易云网页登录</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              将在独立窗口中打开网易云音乐官方网页。登录完成后，WaveYourYarn 会在本机读取该窗口的登录状态，用于访问你自己的音乐数据。
            </p>
          </div>

          <div className="mt-6 rounded-md bg-muted p-4 text-sm">
            <p className="font-medium">{webLoginStatusText[status]}</p>
            <p className="mt-1 text-muted-foreground">
              登录窗口会自动检测登录状态。完成登录后，应用会关闭该窗口并返回首页。
            </p>
          </div>

          {error && status === 'failed' ? (
            <div className="mt-4">
              <ErrorState message={error} />
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleOpenWebLogin()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '等待网页登录完成...' : '打开网易云网页登录'}
            </button>
            <Link
              to="/"
              className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              返回首页
            </Link>
          </div>
        </section>

        <aside className="rounded-md border bg-white p-6">
          <h3 className="text-lg font-semibold">登录说明</h3>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>1. 点击按钮后，在弹出的网易云官方网页中登录。</p>
            <p>2. 可以使用网易云网页自带的扫码或账号登录。</p>
            <p>3. WaveYourYarn 只读取本应用登录窗口的网易云 Cookie。</p>
            <p>4. 第三方 API 二维码登录已不再作为正式入口。</p>
          </div>
        </aside>
      </div>

      <section className="mt-6 rounded-md border bg-white p-6">
        <button
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {showAdvanced ? '收起高级选项' : '展开高级选项：手动导入 Cookie'}
        </button>

        {showAdvanced ? (
          <div className="mt-5">
            <p className="text-sm text-muted-foreground">
              Cookie 相当于登录凭证，请只在本机使用，不要分享给任何人。普通用户无需使用此功能。
            </p>
            <textarea
              value={manualCookie}
              onChange={(event) => setManualCookie(event.target.value)}
              placeholder="粘贴 music.163.com Cookie，例如 MUSIC_U=...; __csrf=..."
              className="mt-4 min-h-32 w-full resize-y rounded-md border bg-white p-3 text-sm outline-none focus:border-primary"
            />
            {manualError ? (
              <div className="mt-4">
                <ErrorState message={manualError} />
              </div>
            ) : null}
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleCookieLogin()}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              验证并登录
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
