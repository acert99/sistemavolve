'use client'

import { formatDateTimeInAppTimeZone } from '@/lib/timezone'
import type { LeadDetail } from '../types'

const TIMELINE_LABELS: Record<string, string> = {
  stage_change: 'Mudanca de etapa',
  wa_sent: 'WhatsApp enviado',
  wa_received: 'WhatsApp recebido',
  note: 'Anotacao',
  proposal_sent: 'Proposta enviada',
  meeting_scheduled: 'Reuniao agendada',
  converted: 'Lead convertido',
}

export function LeadTimeline({ items }: { items: LeadDetail['timeline'] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center text-sm text-slate-400">
        Nenhum evento registrado ainda.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {TIMELINE_LABELS[item.type] ?? item.type}
              </p>
              <p className="text-xs text-slate-500">
                {item.creator?.nome ?? 'Sistema'} · {formatDateTimeInAppTimeZone(item.createdAt)}
              </p>
            </div>
            <span className="badge-gray">{item.type}</span>
          </div>

          {item.content ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
              {item.content}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}
