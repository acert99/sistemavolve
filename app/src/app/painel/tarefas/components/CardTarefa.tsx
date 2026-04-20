'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendTaskToApprovalAction } from '@/app/painel/tarefas/actions'
import type { TaskCardView, TaskGroupId } from '@/app/painel/tarefas/types'

interface CardTarefaProps {
  task: TaskCardView
  groupId: TaskGroupId
}

const priorityClasses = {
  urgent: 'badge-red',
  high: 'badge-yellow',
  normal: 'badge-blue',
  low: 'badge-gray',
} as const

const dateClasses: Record<TaskGroupId, string> = {
  enviar_cliente: 'badge-purple',
  atrasado: 'badge-red',
  hoje: 'badge-yellow',
  amanha: 'badge-yellow',
  esta_semana: 'badge-blue',
  sem_prazo: 'badge-gray',
  bloqueado: 'badge-yellow',
  aprovado: 'badge-green',
  proximas_semanas: 'badge-gray',
  outros: 'badge-gray',
}

function buildStatusStyle(color: string | null) {
  if (!color) return undefined

  return {
    borderColor: color,
    color,
  }
}

function buildTagStyle(backgroundColor: string | null, textColor: string | null) {
  if (!backgroundColor && !textColor) return undefined

  return {
    backgroundColor: backgroundColor ?? undefined,
    borderColor: backgroundColor ?? undefined,
    color: textColor ?? undefined,
  }
}

export function CardTarefa({ task, groupId }: CardTarefaProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  function handleSendForApproval() {
    setActionError(null)

    startTransition(async () => {
      const result = await sendTaskToApprovalAction(task.id)

      if (!result.success) {
        setActionError(result.error)
        return
      }

      router.refresh()
    })
  }

  return (
    <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.35)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={dateClasses[groupId]}>{task.dueDateLabel ?? 'Sem prazo'}</span>
          <span
            className="inline-flex items-center rounded-full border bg-white px-2.5 py-1 text-xs font-semibold"
            style={buildStatusStyle(task.statusColor)}
          >
            {task.statusLabel}
          </span>
          {task.priorityKey ? (
            <span className={priorityClasses[task.priorityKey]}>{task.priorityLabel}</span>
          ) : null}
          {task.returnsOnMonday ? <span className="badge-blue">volta na segunda</span> : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-base font-semibold tracking-tight text-slate-950">{task.name}</p>
              <p className="text-sm text-slate-500">
                {task.portfolioName}
                {' '}
                ·
                {' '}
                {task.clientName}
              </p>
            </div>
          </div>

          <p className="text-sm leading-6 text-slate-600">{task.dueContextLabel}</p>
          <p className="text-xs text-slate-400">Atualizada em {task.updatedAtLabel}</p>
        </div>

        {task.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {task.tags.map((tag) => (
              <span
                key={tag.name}
                className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium"
                style={buildTagStyle(tag.backgroundColor, tag.textColor)}
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {task.assignees.length > 0 ? (
              task.assignees.map((assignee) => (
                <div
                  key={assignee.id}
                  title={assignee.name}
                  className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700"
                >
                  {assignee.avatarUrl ? (
                    <img
                      src={assignee.avatarUrl}
                      alt={assignee.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    assignee.initials
                  )}
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-400">Sem responsavel atribuido</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={task.url}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              Abrir no ClickUp
            </a>
            {task.canSendForApproval ? (
              <button
                type="button"
                onClick={handleSendForApproval}
                disabled={isPending}
                className="btn-primary"
              >
                {isPending ? 'Enviando...' : 'Enviar para aprovacao'}
              </button>
            ) : null}
          </div>
        </div>

        {actionError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {actionError}
          </div>
        ) : null}
      </div>
    </article>
  )
}
