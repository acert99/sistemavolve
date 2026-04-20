'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/panel/empty-state'
import { ArrowRightIcon, CommunicationIcon, ProposalIcon } from '@/components/panel/icons'
import { PageHeader } from '@/components/panel/page-header'
import { formatDateInAppTimeZone, formatDateTimeInAppTimeZone } from '@/lib/timezone'
import { LEAD_SOURCE_LABELS, LEAD_STAGE_BADGES, LEAD_STAGE_LABELS } from '../constants'
import { EnviarMensagemWA } from '../components/EnviarMensagemWA'
import { LeadActions } from '../components/LeadActions'
import { LeadTimeline } from '../components/LeadTimeline'
import type { LeadDetail } from '../types'

interface LeadPageProps {
  params: { id: string }
}

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) return '-'

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function LeadDetailPage({ params }: LeadPageProps) {
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  async function fetchLead() {
    setLoading(true)

    const response = await fetch(`/api/leads/${params.id}`, { cache: 'no-store' })
    const data = await response.json()

    if (data.success) {
      setLead(data.data)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchLead()
  }, [params.id])

  async function handleCreateNote(event: React.FormEvent) {
    event.preventDefault()
    setSavingNote(true)

    const response = await fetch(`/api/leads/${params.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: note }),
    })
    const data = await response.json()

    setSavingNote(false)

    if (!data.success) {
      alert(data.error ?? 'Nao foi possivel salvar a anotacao')
      return
    }

    setNote('')
    fetchLead()
  }

  if (loading) {
    return <div className="card py-16 text-center text-sm text-slate-500">Carregando lead...</div>
  }

  if (!lead) {
    return (
      <EmptyState
        title="Lead nao encontrado"
        description="Volte para o pipeline e selecione outro contato."
        action={
          <Link href="/painel/clientes" className="btn-primary">
            Voltar ao CRM
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lead"
        title={lead.name}
        description="Concentre historico, proxima acao, proposta e follow-up em uma unica tela operacional."
        meta={[
          { label: LEAD_SOURCE_LABELS[lead.source] },
          { label: lead.company || lead.phone },
          { label: lead.clientId ? 'Cliente convertido' : 'Ainda no pipeline' },
        ]}
        actions={
          <>
            <Link href="/painel/clientes" className="btn-secondary">
              Voltar
            </Link>
            <Link href="/painel/comercial" className="btn-primary">
              Metricas
            </Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <section className="card space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className={LEAD_STAGE_BADGES[lead.stage]}>{LEAD_STAGE_LABELS[lead.stage]}</span>
            {lead.estimatedValue !== null ? (
              <span className="badge-blue">{formatCurrency(Number(lead.estimatedValue))}</span>
            ) : null}
            {lead.client ? <span className="badge-green">{lead.client.nome}</span> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contato</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>Telefone: {lead.phone}</p>
                <p>Email: {lead.email || '-'}</p>
                <p>Instagram: {lead.instagram || '-'}</p>
                <p>Responsavel: {lead.assignee?.nome || '-'}</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Proxima acao</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>{lead.nextAction || 'Nao definida'}</p>
                <p>{lead.nextActionDate ? formatDateTimeInAppTimeZone(lead.nextActionDate) : '-'}</p>
                <p>Criado em {formatDateInAppTimeZone(lead.createdAt)}</p>
                <p>Etapa atualizada em {formatDateTimeInAppTimeZone(lead.stageChangedAt)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Interesse</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {lead.servicesInterest.length > 0 ? (
                lead.servicesInterest.map((service) => (
                  <span key={service} className="badge-gray">
                    {service}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-400">Nenhum servico informado.</span>
              )}
            </div>
            {lead.notes ? (
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">{lead.notes}</p>
            ) : null}
          </div>

          <LeadActions lead={lead} onRefresh={fetchLead} />
        </section>

        <section className="space-y-6">
          <div className="card space-y-4">
            <div className="space-y-1">
              <h2 className="section-title">WhatsApp do lead</h2>
              <p className="section-copy">
                Envie uma mensagem manual ou agende um toque sem sair do CRM.
              </p>
            </div>
            <EnviarMensagemWA leadId={lead.id} leadStage={lead.stage} onSent={fetchLead} />
          </div>

          <div className="card space-y-4">
            <div className="space-y-1">
              <h2 className="section-title">Anotacao rapida</h2>
              <p className="section-copy">
                Registre contexto de reuniao, objecao ou proximo passo comercial.
              </p>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-3">
              <textarea
                rows={4}
                className="input resize-none"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ex.: pediu ajuste de escopo, prefere contato na sexta, quer contrato mensal..."
              />
              <div className="flex justify-end">
                <button type="submit" disabled={savingNote || !note.trim()} className="btn-primary">
                  {savingNote ? 'Salvando...' : 'Salvar anotacao'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <section className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="section-title">Propostas ligadas ao lead</h2>
              <p className="section-copy">
                Todo envio feito por aqui alimenta a etapa `proposal` automaticamente.
              </p>
            </div>
            <ProposalIcon className="h-5 w-5 text-slate-400" />
          </div>

          {lead.propostas.length === 0 ? (
            <EmptyState
              title="Nenhuma proposta criada"
              description="Use a acao acima para gerar e enviar a primeira proposta a partir deste lead."
            />
          ) : (
            <div className="space-y-3">
              {lead.propostas.map((proposta) => (
                <div key={proposta.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{proposta.titulo}</p>
                      <p className="text-xs text-slate-500">
                        Criada em {formatDateInAppTimeZone(proposta.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="badge-blue">{proposta.status}</span>
                      <a
                        href={`/propostas/${proposta.token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-volve-700 hover:text-volve-800"
                      >
                        Abrir link
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="section-title">Timeline comercial</h2>
              <p className="section-copy">
                Historico unificado de etapa, mensagens e anotacoes.
              </p>
            </div>
            <CommunicationIcon className="h-5 w-5 text-slate-400" />
          </div>
          <LeadTimeline items={lead.timeline} />
        </section>
      </div>

      <section className="card space-y-4">
        <div className="space-y-1">
          <h2 className="section-title">Follow-up pendente</h2>
          <p className="section-copy">
            Jobs automaticos e mensagens manuais agendadas para este lead.
          </p>
        </div>

        {lead.followUpJobs.length === 0 ? (
          <EmptyState
            title="Nenhum follow-up pendente"
            description="Ao entrar em proposta ou agendar mensagens, os jobs aparecem aqui."
          />
        ) : (
          <div className="space-y-3">
            {lead.followUpJobs.map((job) => (
              <div key={job.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{job.type}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTimeInAppTimeZone(job.scheduledAt)}
                    </p>
                  </div>
                  <span className={job.status === 'failed' ? 'badge-red' : job.status === 'cancelled' ? 'badge-gray' : 'badge-blue'}>
                    {job.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{job.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
