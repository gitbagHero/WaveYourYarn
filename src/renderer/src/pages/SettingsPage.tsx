import { Link } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'

export function SettingsPage(): JSX.Element {
  const version = useAppStore((state) => state.version)
  const { isLoggedIn, user, loading, error, logout } = useAuthStore()

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
            <dd className="font-medium">{isLoggedIn ? '已连接' : '未连接'}</dd>
          </div>
          <div className="flex justify-between border-b pb-3">
            <dt className="text-muted-foreground">当前用户</dt>
            <dd className="flex items-center gap-2 font-medium">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.nickname} className="h-6 w-6 rounded-full" />
              ) : null}
              {user?.nickname ?? '-'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">本地缓存</dt>
            <dd className="font-medium">SQLite 已预留</dd>
          </div>
        </dl>

        {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 flex gap-3">
          {isLoggedIn ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void logout()}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '正在退出...' : '退出登录'}
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              重新登录
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
