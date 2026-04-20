import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
  secondaryAction?: ReactNode
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="panel-empty">
      {icon ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-volve-50 text-volve-700">
          {icon}
        </div>
      ) : null}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mx-auto max-w-xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
