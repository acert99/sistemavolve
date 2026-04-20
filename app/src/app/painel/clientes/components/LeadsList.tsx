'use client'

import Link from 'next/link'
import { formatDateInAppTimeZone, formatDateTimeInAppTimeZone } from '@/lib/timezone'
import { LEAD_SOURCE_LABELS, LEAD_STAGE_BADGES, LEAD_STAGE_LABELS } from '../constants'
import type { LeadListItem } from '../types'

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) return '-'

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

export function LeadsList({ leads }: { leads: LeadListItem[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="table-auto w-full">
        <thead>
          <tr>
            <th>Lead</th>
            <th>Origem</th>
            <th>Etapa</th>
            <th>Valor</th>
            <th>Proxima acao</th>
            <th>Atualizado</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>
                <div className="space-y-1">
                  <p className="font-medium text-slate-900">{lead.name}</p>
                  <p className="text-xs text-slate-500">
                    {lead.company || lead.email || lead.phone}
                  </p>
                </div>
              </td>
              <td>{LEAD_SOURCE_LABELS[lead.source]}</td>
              <td>
                <span className={LEAD_STAGE_BADGES[lead.stage]}>
                  {LEAD_STAGE_LABELS[lead.stage]}
                </span>
              </td>
              <td>{formatCurrency(lead.estimatedValue !== null ? Number(lead.estimatedValue) : null)}</td>
              <td>
                <div className="space-y-1 text-xs text-slate-500">
                  <p>{lead.nextAction || '-'}</p>
                  {lead.nextActionDate ? (
                    <p>{formatDateTimeInAppTimeZone(lead.nextActionDate)}</p>
                  ) : null}
                </div>
              </td>
              <td>{formatDateInAppTimeZone(lead.stageChangedAt)}</td>
              <td>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/painel/clientes/${lead.id}`} className="text-xs font-semibold text-volve-700 hover:text-volve-800">
                    Abrir
                  </Link>
                  {lead.clientId ? (
                    <span className="text-xs text-emerald-700">Cliente criado</span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
