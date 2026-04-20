'use client'

import Link from 'next/link'
import { differenceInAppCalendarDays, formatDateTimeInAppTimeZone } from '@/lib/timezone'
import type { LeadListItem } from '../types'
import { LEAD_SOURCE_LABELS, LEAD_STAGE_BADGES, LEAD_STAGE_LABELS } from '../constants'

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) return null

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

function getUrgency(lead: LeadListItem) {
  const now = new Date()

  if (lead.stage === 'new') {
    const ageHours = Math.floor((now.getTime() - new Date(lead.createdAt).getTime()) / 3600000)
    if (ageHours >= 2 && (lead._count?.timeline ?? 0) === 0) {
      return { className: 'badge-red', label: 'Sem contato 2h+' }
    }
  }

  if (lead.nextActionDate && new Date(lead.nextActionDate) < now) {
    return { className: 'badge-red', label: 'Acao atrasada' }
  }

  if (lead.stage === 'proposal') {
    const days = differenceInAppCalendarDays(now, lead.stageChangedAt)
    if (days >= 14) return { className: 'badge-red', label: 'Sem resposta D+14' }
    if (days >= 7) return { className: 'badge-yellow', label: 'Sem resposta D+7' }
    if (days >= 3) return { className: 'badge-blue', label: 'Sem resposta D+3' }
  }

  return null
}

export function CardLead({ lead, draggable = false }: { lead: LeadListItem; draggable?: boolean }) {
  const urgency = getUrgency(lead)
  const estimatedValue = formatCurrency(
    lead.estimatedValue !== null ? Number(lead.estimatedValue) : null,
  )

  return (
    <article
      className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
      draggable={draggable}
      data-lead-id={lead.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-950">{lead.name}</p>
          <p className="text-xs text-slate-500">
            {lead.company || LEAD_SOURCE_LABELS[lead.source]}
          </p>
        </div>
        <span className={LEAD_STAGE_BADGES[lead.stage]}>{LEAD_STAGE_LABELS[lead.stage]}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="badge-gray">{LEAD_SOURCE_LABELS[lead.source]}</span>
        {estimatedValue ? <span className="badge-blue">{estimatedValue}</span> : null}
        {urgency ? <span className={urgency.className}>{urgency.label}</span> : null}
      </div>

      <div className="mt-4 space-y-2 text-xs text-slate-500">
        <p>Telefone: {lead.phone}</p>
        {lead.assignee?.nome ? <p>Responsavel: {lead.assignee.nome}</p> : null}
        {lead.nextAction ? <p>Proxima acao: {lead.nextAction}</p> : null}
        {lead.nextActionDate ? (
          <p>Quando: {formatDateTimeInAppTimeZone(lead.nextActionDate)}</p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          {(lead._count?.propostas ?? 0) > 0
            ? `${lead._count?.propostas ?? 0} proposta(s)`
            : 'Sem proposta ainda'}
        </div>
        <Link href={`/painel/clientes/${lead.id}`} className="text-sm font-semibold text-volve-700 hover:text-volve-800">
          Abrir
        </Link>
      </div>
    </article>
  )
}
