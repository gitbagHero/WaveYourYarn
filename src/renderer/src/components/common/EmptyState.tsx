interface EmptyStateProps {
  title: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps): JSX.Element {
  return (
    <div className="rounded-md border border-dashed bg-white p-8 text-center">
      <h3 className="font-medium">{title}</h3>
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}
