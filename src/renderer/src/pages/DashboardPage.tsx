import { Link } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { useAppStore } from '../stores/appStore'
import { useEffect, useState } from 'react'
import { appApi } from '../api/appApi'

const quickLinks = [
  { to: '/login', label: '连接网易云' },
  { to: '/liked-songs', label: '同步我喜欢的音乐' },
  { to: '/liked-songs', label: '查看歌曲列表' },
  { to: '/export', label: '导出歌曲数据' }
]

export function DashboardPage(): JSX.Element {
  const version = useAppStore((state) => state.version)
  const [ping, setPing] = useState('-')

  useEffect(() => {
    appApi.ping().then((result) => {
      setPing(result.success ? (result.data ?? '-') : result.message ?? 'IPC failed')
    })
  }, [])

  return (
    <div>
      <PageHeader title="WaveYourYarn" description="让你的音乐故事像声波一样荡漾开来" />

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="当前版本" value={version ? `v${version}` : '-'} />
        <Metric label="登录状态" value="未连接" />
        <Metric label="喜欢歌曲数量" value="0" />
        <Metric label="最近同步时间" value="尚未同步" />
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
