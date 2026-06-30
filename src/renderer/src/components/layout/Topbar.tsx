import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import { useAuthStore } from '../../stores/authStore'

export function Topbar(): JSX.Element {
  const { version, loadVersion } = useAppStore()
  const { user, isLoggedIn, checkLoginStatus } = useAuthStore()

  useEffect(() => {
    loadVersion()
    checkLoginStatus()
  }, [loadVersion, checkLoginStatus])

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-8">
      <div>
        <p className="text-sm font-medium">WaveYourYarn 工作台</p>
        <p className="text-xs text-muted-foreground">让你的音乐故事像声波一样荡漾开来</p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to={isLoggedIn ? '/settings' : '/login'}
          className="flex items-center gap-2 rounded-md border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.nickname} className="h-5 w-5 rounded-full" />
          ) : null}
          {isLoggedIn ? user?.nickname : '未连接网易云'}
        </Link>
        <div className="rounded-md border px-3 py-1 text-xs text-muted-foreground">
          v{version ?? '-'}
        </div>
      </div>
    </header>
  )
}
