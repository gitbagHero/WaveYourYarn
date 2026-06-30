interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = '加载中...' }: LoadingStateProps): JSX.Element {
  return <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground">{message}</div>
}
