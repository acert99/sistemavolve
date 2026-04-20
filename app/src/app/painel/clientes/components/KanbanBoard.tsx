'use client'

import { useState } from 'react'
import type { LeadStage } from '@/types'
import { CardLead } from './CardLead'
import { LEAD_STAGE_LABELS, PIPELINE_STAGES } from '../constants'
import type { LeadListItem } from '../types'

interface KanbanBoardProps {
  columns: Array<{
    stage: LeadStage
    items: LeadListItem[]
  }>
  movingLeadId?: string | null
  onMove: (leadId: string, stage: LeadStage) => Promise<void> | void
}

export function KanbanBoard({ columns, movingLeadId = null, onMove }: KanbanBoardProps) {
  const [dragLeadId, setDragLeadId] = useState<string | null>(null)
  const [hoverStage, setHoverStage] = useState<LeadStage | null>(null)

  const orderedColumns = PIPELINE_STAGES.map(
    (stage) => columns.find((column) => column.stage === stage) ?? { stage, items: [] },
  )

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {orderedColumns.map((column) => (
        <section
          key={column.stage}
          className={`rounded-[28px] border p-4 transition-colors ${
            hoverStage === column.stage
              ? 'border-volve-300 bg-volve-50/60'
              : 'border-white/70 bg-white/80'
          }`}
          onDragOver={(event) => {
            event.preventDefault()
            setHoverStage(column.stage)
          }}
          onDragLeave={() => setHoverStage((current) => (current === column.stage ? null : current))}
          onDrop={async (event) => {
            event.preventDefault()
            const leadId = event.dataTransfer.getData('text/plain') || dragLeadId
            setHoverStage(null)
            setDragLeadId(null)
            if (!leadId) return
            await onMove(leadId, column.stage)
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">{LEAD_STAGE_LABELS[column.stage]}</h2>
              <p className="text-xs text-slate-500">{column.items.length} lead(s)</p>
            </div>
            <span className="badge-gray">{column.items.length}</span>
          </div>

          <div className="space-y-3">
            {column.items.map((lead) => (
              <div
                key={lead.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', lead.id)
                  setDragLeadId(lead.id)
                }}
                className={movingLeadId === lead.id ? 'pointer-events-none opacity-50' : ''}
              >
                <CardLead lead={lead} draggable />
              </div>
            ))}
            {column.items.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-400">
                Arraste um lead para esta etapa.
              </div>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  )
}
