import { PageHeader } from '../components/common/PageHeader'
import { useAppStore } from '../stores/appStore'

export function SettingsPage(): JSX.Element {
  const version = useAppStore((state) => state.version)

  return (
    <div>
      <PageHeader title="设置" description="管理登录状态、本地缓存、导出路径和应用信息。" />
      <div className="rounded-md border bg-white p-6">
        <dl className="grid gap-4 text-sm">
          <div className="flex justify-between border-b pb-3">
            <dt className="text-muted-foreground">应用版本</dt>
            <dd className="font-medium">v{version ?? '-'}</dd>
          </div>
          <div className="flex justify-between border-b pb-3">
            <dt className="text-muted-foreground">网易云登录状态</dt>
            <dd className="font-medium">未连接</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">本地缓存</dt>
            <dd className="font-medium">SQLite 已预留</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
