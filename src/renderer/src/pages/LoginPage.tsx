import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/authApi'
import { ErrorState } from '../components/common/ErrorState'
import { LoadingState } from '../components/common/LoadingState'
import { PageHeader } from '../components/common/PageHeader'
import { useAuthStore } from '../stores/authStore'
import type { LoginStatusResult, QrLoginStatus } from '../types/auth'

type LoginPageStatus = 'idle' | 'loading_qr' | QrLoginStatus

const statusText: Record<LoginPageStatus, string> = {
  idle: '尚未生成二维码',
  loading_qr: '正在生成二维码...',
  waiting: '请使用网易云音乐 App 扫码',
  scanned: '已扫码，请在手机上确认登录',
  authorized: '登录成功',
  expired: '二维码已过期，请刷新后重新扫码',
  failed: '扫码登录失败，请改用网页登录或手动 Cookie'
}

export function LoginPage(): JSX.Element {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const [status, setStatus] = useState<LoginPageStatus>('idle')
  const [qrKey, setQrKey] = useState<string | null>(null)
  const [qrImageBase64, setQrImageBase64] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [manualCookie, setManualCookie] = useState('')
  const [webLoginLoading, setWebLoginLoading] = useState(false)
  const [manualLoginLoading, setManualLoginLoading] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const [webError, setWebError] = useState<string | null>(null)
  const [manualError, setManualError] = useState<string | null>(null)
  const pollTimerRef = useRef<number | null>(null)

  const applyLoginResult = useCallback(
    (loginStatus?: LoginStatusResult) => {
      if (loginStatus?.isLoggedIn && loginStatus.user) {
        setUser(loginStatus.user)
        window.setTimeout(() => navigate('/'), 500)
        return true
      }

      return false
    },
    [navigate, setUser]
  )

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const startPolling = useCallback(
    (key: string) => {
      stopPolling()
      pollTimerRef.current = window.setInterval(async () => {
        const result = await authApi.checkQrStatus(key)

        if (!result.success || !result.data) {
          setStatus('failed')
          setQrError(result.message ?? '二维码状态检查失败')
          stopPolling()
          return
        }

        setStatus(result.data.status)
        setQrError(result.data.status === 'failed' ? result.data.message ?? '扫码登录失败' : null)

        if (result.data.status === 'expired') {
          setQrError('二维码已过期。如果手机提示设备环境异常，请使用网页登录。')
          stopPolling()
          return
        }

        if (result.data.status === 'failed') {
          stopPolling()
          return
        }

        if (result.data.status === 'authorized') {
          stopPolling()
          if (result.data.user) {
            setUser(result.data.user)
            window.setTimeout(() => navigate('/'), 500)
            return
          }

          setQrError('登录成功，但用户信息获取失败')
          setStatus('failed')
        }
      }, 2000)
    },
    [navigate, setUser, stopPolling]
  )

  const loadQrCode = useCallback(async () => {
    stopPolling()
    setStatus('loading_qr')
    setQrError(null)
    setQrKey(null)
    setQrImageBase64(null)
    setQrUrl(null)

    const result = await authApi.getLoginQr()

    if (!result.success || !result.data) {
      setStatus('failed')
      setQrError(result.message ?? '二维码生成失败')
      return
    }

    setQrKey(result.data.key)
    setQrImageBase64(result.data.qrImageBase64 ?? null)
    setQrUrl(result.data.qrUrl ?? null)
    setStatus('waiting')
    startPolling(result.data.key)
  }, [startPolling, stopPolling])

  const startWebLogin = async (): Promise<void> => {
    setWebError(null)
    setWebLoginLoading(true)
    const result = await authApi.startWebLogin()
    setWebLoginLoading(false)

    if (!result.success) {
      setWebError(result.message ?? '网页登录窗口打开失败')
    }
  }

  const completeWebLogin = async (): Promise<void> => {
    setWebError(null)
    setWebLoginLoading(true)
    const result = await authApi.completeWebLogin()
    setWebLoginLoading(false)

    if (!result.success || !applyLoginResult(result.data)) {
      setWebError(result.message ?? '网页登录验证失败，请确认已在弹出的窗口中完成登录')
    }
  }

  const loginWithCookie = async (): Promise<void> => {
    setManualError(null)
    setManualLoginLoading(true)
    const result = await authApi.loginWithCookie(manualCookie)
    setManualLoginLoading(false)

    if (!result.success || !applyLoginResult(result.data)) {
      setManualError(result.message ?? 'Cookie 无效或已过期，请重新获取')
    }
  }

  useEffect(() => stopPolling, [stopPolling])

  return (
    <div>
      <PageHeader title="连接网易云音乐" description="推荐使用网页登录；扫码登录保留为实验方案。" />

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-md border bg-white p-6">
          <div className="mb-4">
            <span className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">推荐</span>
            <h3 className="mt-3 text-lg font-semibold">网页登录</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              将在独立窗口中打开网易云官方网页。登录完成后，WaveYourYarn 只读取该窗口的登录 Cookie。
            </p>
          </div>

          {webError ? <ErrorState message={webError} /> : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={webLoginLoading}
              onClick={() => void startWebLogin()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {webLoginLoading ? '处理中...' : '打开网易云网页登录'}
            </button>
            <button
              type="button"
              disabled={webLoginLoading}
              onClick={() => void completeWebLogin()}
              className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
            >
              我已完成登录
            </button>
          </div>
        </section>

        <section className="rounded-md border bg-white p-6">
          <div className="mb-4">
            <span className="rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">实验</span>
            <h3 className="mt-3 text-lg font-semibold">扫码登录</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              该方式可能受到网易云风控影响。如果手机提示设备环境异常，请使用网页登录。
            </p>
          </div>

          <div className="grid min-h-72 place-items-center rounded-md border border-dashed bg-muted/40 p-4">
            {status === 'loading_qr' ? <LoadingState message="正在生成二维码..." /> : null}
            {qrImageBase64 ? (
              <img src={qrImageBase64} alt="网易云扫码登录二维码" className="h-56 w-56 rounded-md bg-white p-3" />
            ) : null}
            {!qrImageBase64 && status !== 'loading_qr' ? (
              <div className="text-center text-sm text-muted-foreground">
                二维码暂未生成
                {qrUrl ? (
                  <a className="mt-2 block text-primary hover:underline" href={qrUrl} target="_blank" rel="noreferrer">
                    打开登录链接
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">{statusText[status]}</p>
            {qrKey ? <p className="mt-1 text-xs text-muted-foreground">二维码已生成，等待扫码确认。</p> : null}
          </div>

          {qrError ? (
            <div className="mt-4">
              <ErrorState message={qrError} />
            </div>
          ) : null}

          <button
            type="button"
            onClick={loadQrCode}
            className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            生成 / 刷新二维码
          </button>
        </section>

        <section className="rounded-md border bg-white p-6">
          <div className="mb-4">
            <span className="rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">高级</span>
            <h3 className="mt-3 text-lg font-semibold">手动导入 Cookie</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Cookie 相当于登录凭证，请只在本机使用，不要分享给任何人。
            </p>
          </div>

          <textarea
            value={manualCookie}
            onChange={(event) => setManualCookie(event.target.value)}
            placeholder="粘贴 music.163.com Cookie，例如 MUSIC_U=...; __csrf=..."
            className="min-h-48 w-full resize-y rounded-md border bg-white p-3 text-sm outline-none focus:border-primary"
          />

          {manualError ? (
            <div className="mt-4">
              <ErrorState message={manualError} />
            </div>
          ) : null}

          <button
            type="button"
            disabled={manualLoginLoading}
            onClick={() => void loginWithCookie()}
            className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {manualLoginLoading ? '正在验证...' : '验证并登录'}
          </button>
        </section>
      </div>

      <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
        返回首页
      </Link>
    </div>
  )
}
