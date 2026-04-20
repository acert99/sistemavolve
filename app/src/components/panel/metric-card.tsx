import Link from 'next/link'
import type { ReactNode } from 'react'

type MetricTone = 'volve' | 'success' | 'warning' | 'danger' | 'neutral'

interface MetricCardProps {
  label: string
  value: string | number
  hint?: string
  tone?: MetricTone
  icon?: ReactNode
  href?: string
}

const toneClasses: Record<MetricTone, string> = {
  volve: 'from-volve-700 via-volve-700 to-slate-900 text-white',
  success: 'from-emerald-500 via-emerald-500 to-emerald-700 text-white',
  warning: 'from-amber-400 via-amber-500 to-orange-600 text-white',
  danger: 'from-rose-500 via-rose-500 to-rose-700 text-white',
  neutral: 'from-white via-white to-slate-100 text-slate-900',
}

export function MetricCard({
  label,
  value,
  hint,
  tone = 'volve',
  icon,
  href,
}: MetricCardProps) {
  const content = (
    <div className={`metric-card bg-gradient-to-br ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className={`text-sm font-medium ${tone === 'neutral' ? 'text-slate-500' : 'text-white/80'}`}>
            {label}
          </p>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        {icon ? (
          <div className={`rounded-2xl border p-3 ${tone === 'neutral' ? 'border-slate-200 bg-white text-slate-500' : 'border-white/20 bg-white/10 text-white'}`}>
            {icon}
          </div>
        ) : null}
      </div>
      {hint ? (
        <p className={`mt-4 text-sm ${tone === 'neutral' ? 'text-slate-500' : 'text-white/75'}`}>
          {hint}
        </p>
      ) : null}
    </div>
  )

  if (!href) return content

  return (
    <Link href={href} className="block transition-transform duration-200 hover:-translate-y-0.5">
      {content}
    </Link>
  )
}
