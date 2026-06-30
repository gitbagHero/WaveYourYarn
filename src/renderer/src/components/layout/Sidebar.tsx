import { BarChart3, Download, Heart, Home, LogIn, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { APP_NAME } from '../../utils/constants'

const items = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/login', label: '网易云登录', icon: LogIn },
  { to: '/liked-songs', label: '我喜欢的音乐', icon: Heart },
  { to: '/export', label: '数据导出', icon: Download },
  { to: '/settings', label: '设置', icon: Settings }
]

export function Sidebar(): JSX.Element {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-white">
      <div className="border-b px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="text-base font-semibold">{APP_NAME}</h1>
            <p className="text-xs text-muted-foreground">个人音乐数据工具</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                ].join(' ')
              }
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
