import { Link } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { useAppStore } from '../stores/appStore'
import { useEffect, useState } from 'react'
import { appApi } from '../api/appApi'
import { useAuthStore } from '../stores/authStore'

const quickLinks = [
  { to: '/login', label: '连接网易云' },
  { to: '/liked-songs', label: '同步我喜欢的音乐' },
  { to: '/liked-songs', label: '查看歌曲列表' },
  { to: '/export', label: '导出歌曲数据' }
]

export function DashboardPage(): JSX.Element {
  const version = useAppStore((state) => state.version)
  const { isLoggedIn, user, checkLoginStatus } = useAuthStore()
  const [ping, setPing] = useState('-')

  useEffect(() => {
    checkLoginStatus()
    appApi.ping().then((result) => {
      setPing(result.success ? (result.data ?? '-') : result.message ?? 'IPC failed')
    })
  }, [checkLoginStatus])

  return (
    <div>
      <PageHeader title="WaveYourYarn" description="让你的音乐故事像声波一样荡漾开来" />

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="当前版本" value={version ? `v${version}` : '-'} />
        <Metric label="登录状态" value={isLoggedIn ? '网易云已连接' : '未连接'} />
        <Metric label="喜欢歌曲数量" value="0" />
        <Metric label="最近同步时间" value="尚未同步" />
      </section>

      <section className="mt-6 rounded-md border bg-white p-6">
        {isLoggedIn && user ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.nickname} className="h-14 w-14 rounded-full" />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-full bg-muted text-lg font-semibold">
                  {user.nickname.slice(0, 1)}
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">网易云已连接</p>
                <h3 className="text-xl font-semibold">{user.nickname}</h3>
              </div>
            </div>
            <Link
              to="/liked-songs"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              同步我喜欢的音乐
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">当前未连接网易云音乐</h3>
              <p className="mt-1 text-sm text-muted-foreground">连接账号后即可读取个人音乐数据。</p>
            </div>
            <Link
              to="/login"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              连接网易云
            </Link>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-md border bg-white p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">快速入口</h3>
          <p className="mt-1 text-sm text-muted-foreground">当前阶段提供页面跳转和 IPC 验证。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {quickLinks.map((link) => (
            <Link
              key={`${link.to}-${link.label}`}
              to={link.to}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="mt-5 rounded-md bg-muted p-3 text-sm text-muted-foreground">
          IPC ping result: {ping}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border bg-white p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  )
}
