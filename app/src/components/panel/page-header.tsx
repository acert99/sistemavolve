import type { ReactNode } from 'react'

type MetaTone = 'default' | 'success' | 'warning' | 'danger'

interface MetaItem {
  label: string
  tone?: MetaTone
}

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description: string
  meta?: MetaItem[]
  actions?: ReactNode
}

const toneClasses: Record<MetaTone, string> = {
  default: 'border-slate-200 bg-slate-100 text-slate-600',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
}

export function PageHeader({
  eyebrow = 'Operacao',
  title,
  description,
  meta = [],
  actions,
}: PageHeaderProps) {
  return (
    <section className="page-header">
      <div className="space-y-3">
        <p className="panel-kicker">{eyebrow}</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>
        {meta.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {meta.map((item) => (
              <span
                key={item.label}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses[item.tone ?? 'default']}`}
              >
                {item.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </section>
  )
}
