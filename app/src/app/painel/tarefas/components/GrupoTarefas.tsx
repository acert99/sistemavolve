'use client'

import { useState } from 'react'
import { CardTarefa } from '@/app/painel/tarefas/components/CardTarefa'
import type { GroupTone, TaskGroupView } from '@/app/painel/tarefas/types'

const toneClasses: Record<
  GroupTone,
  {
    surface: string
    badge: string
    accent: string
  }
> = {
  danger: {
    surface: 'border-rose-200 bg-rose-50/80',
    badge: 'badge-red',
    accent: 'text-rose-700',
  },
  purple: {
    surface: 'border-violet-200 bg-violet-50/80',
    badge: 'badge-purple',
    accent: 'text-violet-700',
  },
  warning: {
    surface: 'border-amber-200 bg-amber-50/80',
    badge: 'badge-yellow',
    accent: 'text-amber-700',
  },
  info: {
    surface: 'border-sky-200 bg-sky-50/80',
    badge: 'badge-blue',
    accent: 'text-sky-700',
  },
  neutral: {
    surface: 'border-slate-200 bg-slate-50/80',
    badge: 'badge-gray',
    accent: 'text-slate-700',
  },
  blocked: {
    surface: 'border-amber-300 bg-amber-100/80',
    badge: 'badge-yellow',
    accent: 'text-amber-900',
  },
  success: {
    surface: 'border-emerald-200 bg-emerald-50/80',
    badge: 'badge-green',
    accent: 'text-emerald-700',
  },
}

export function GrupoTarefas({ group }: { group: TaskGroupView }) {
  const [collapsed, setCollapsed] = useState(Boolean(group.collapsedByDefault))
  const tone = toneClasses[group.tone]

  return (
    <section className={`rounded-[30px] border p-5 ${tone.surface}`}>
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={`text-lg font-semibold tracking-tight ${tone.accent}`}>{group.title}</h2>
            <span className={tone.badge}>{group.items.length}</span>
            {group.badgeText ? <span className="badge-gray">{group.badgeText}</span> : null}
          </div>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">{group.description}</p>
        </div>

        <span className="text-sm font-semibold text-slate-500">
          {collapsed ? 'Expandir' : 'Recolher'}
        </span>
      </button>

      {!collapsed ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {group.items.map((task) => (
            <CardTarefa key={task.id} task={task} groupId={group.id} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
