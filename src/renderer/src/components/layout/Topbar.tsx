import { useEffect } from 'react'
import { useAppStore } from '../../stores/appStore'

export function Topbar(): JSX.Element {
  const { version, loadVersion } = useAppStore()

  useEffect(() => {
    loadVersion()
  }, [loadVersion])

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-8">
      <div>
        <p className="text-sm font-medium">WaveYourYarn 工作台</p>
        <p className="text-xs text-muted-foreground">让你的音乐故事像声波一样荡漾开来</p>
      </div>
      <div className="rounded-md border px-3 py-1 text-xs text-muted-foreground">v{version ?? '-'}</div>
    </header>
  )
}
