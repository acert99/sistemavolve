'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { EmptyState } from '@/components/panel/empty-state'
import {
  ArrowRightIcon,
  ClientsIcon,
  CommunicationIcon,
  ProposalIcon,
} from '@/components/panel/icons'
import { MetricCard } from '@/components/panel/metric-card'
import { PageHeader } from '@/components/panel/page-header'
import type { LeadSource, LeadStage } from '@/types'
import { KanbanBoard } from './components/KanbanBoard'
import { LeadsList } from './components/LeadsList'
import { ModalNovoLead } from './components/ModalNovoLead'
import { LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS } from './constants'
import type { LeadAlertsResponse, LeadListItem } from './types'

type PipelineResponse = {
  columns: Array<{ stage: LeadStage; items: LeadListItem[] }>
  closed: {
    won: LeadListItem[]
    lost: LeadListItem[]
  }
  summary: {
    wonCount: number
    lostCount: number
    activeClients: number
    stageCounts: Array<{ stage: LeadStage; _count: number }>
  }
}

export default function ClientesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState<'pipeline' | 'list'>('pipeline')
  const [pipeline, setPipeline] = useState<PipelineResponse | null>(null)
  const [alerts, setAlerts] = useState<LeadAlertsResponse | null>(null)
  const [leads, setLeads] = useState<LeadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null)
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all')
  const [includeClosed, setIncludeClosed] = useState(true)

  function updateQuery(nextTab: 'pipeline' | 'list') {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : '',
    )

    if (nextTab === 'pipeline') {
      params.delete('tab')
    } else {
      params.set('tab', nextTab)
    }

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    setActiveTab(nextTab)
    router.replace(nextUrl, { scroll: false })
  }

  async function fetchData() {
    setLoading(true)

    try {
      const leadQuery = new URLSearchParams({
        includeClosed: String(includeClosed),
        limit: '100',
      })

      if (search.trim()) leadQuery.set('q', search.trim())
      if (stageFilter !== 'all') leadQuery.set('stage', stageFilter)
      if (sourceFilter !== 'all') leadQuery.set('source', sourceFilter)

      const [pipelineRes, listRes, alertsRes] = await Promise.all([
        fetch('/api/leads/pipeline', { cache: 'no-store' }),
        fetch(`/api/leads?${leadQuery.toString()}`, { cache: 'no-store' }),
        fetch('/api/leads/alerts', { cache: 'no-store' }),
      ])

      const [pipelineData, listData, alertsData] = await Promise.all([
        pipelineRes.json(),
        listRes.json(),
        alertsRes.json(),
      ])

      if (pipelineData.success) setPipeline(pipelineData.data)
      if (listData.success) setLeads(listData.data)
      if (alertsData.success) setAlerts(alertsData.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [stageFilter, sourceFilter, includeClosed])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    setActiveTab(params.get('tab') === 'list' ? 'list' : 'pipeline')
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData()
    }, 250)

    return () => clearTimeout(timer)
  }, [search])

  const openPipelineCount = useMemo(
    () => pipeline?.columns.reduce((accumulator, column) => accumulator + column.items.length, 0) ?? 0,
    [pipeline],
  )

  async function handleMoveLead(leadId: string, stage: LeadStage) {
    setMovingLeadId(leadId)

    const response = await fetch(`/api/leads/${leadId}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
    const data = await response.json()

    setMovingLeadId(null)

    if (!data.success) {
      alert(data.error ?? 'Nao foi possivel mover o lead')
      return
    }

    fetchData()
  }

  const alertCards = [
    {
      title: 'Leads quentes sem contato',
      description: 'Novos leads ha mais de 2h sem nenhuma acao registrada.',
      count: alerts?.hotLeads.length ?? 0,
      href: '/painel/clientes?tab=list',
    },
    {
      title: 'Proximas acoes vencidas',
      description: 'Leads com tarefa comercial atrasada para hoje ou antes.',
      count: alerts?.overdueActions.length ?? 0,
      href: '/painel/clientes?tab=list',
    },
    {
      title: 'Propostas sem resposta',
      description: 'Leads em proposta com silencio prolongado e risco de esfriar.',
      count: alerts?.proposalWaiting.length ?? 0,
      href: '/painel/clientes?tab=list',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Pipeline comercial"
        description="Controle o lead desde a entrada ate a conversao, com follow-up automatico por WhatsApp e transicao direta para proposta e cliente ativo."
        meta={[
          { label: `${openPipelineCount} lead(s) no pipeline` },
          { label: `${pipeline?.summary.activeClients ?? 0} cliente(s) ativos` },
          {
            label: `${pipeline?.summary.wonCount ?? 0} ganho(s) / ${pipeline?.summary.lostCount ?? 0} perdido(s)`,
          },
        ]}
        actions={
          <>
            <Link href="/painel/comercial" className="btn-secondary">
              Ver metricas
            </Link>
            <button type="button" onClick={() => setShowLeadModal(true)} className="btn-primary">
              Novo lead
            </button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          label="Leads no pipeline"
          value={openPipelineCount}
          hint="Etapas abertas entre novo lead e negociacao."
          tone="volve"
          icon={<ClientsIcon className="h-5 w-5" />}
        />
        <MetricCard
          label="Fechados ganhos"
          value={pipeline?.summary.wonCount ?? 0}
          hint="Conversoes registradas no CRM."
          tone="success"
          icon={<ProposalIcon className="h-5 w-5" />}
        />
        <MetricCard
          label="Acao urgente"
          value={
            (alerts?.hotLeads.length ?? 0) +
            (alerts?.overdueActions.length ?? 0) +
            (alerts?.proposalWaiting.length ?? 0)
          }
          hint="Leads que pedem contato ou definicao agora."
          tone="warning"
          icon={<CommunicationIcon className="h-5 w-5" />}
        />
        <MetricCard
          label="Clientes ativos"
          value={pipeline?.summary.activeClients ?? 0}
          hint="Contatos ja convertidos e integrados a operacao."
          tone="neutral"
          icon={<ArrowRightIcon className="h-5 w-5" />}
        />
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => updateQuery('pipeline')}
            className={activeTab === 'pipeline' ? 'btn-primary' : 'btn-secondary'}
          >
            Pipeline
          </button>
          <button
            type="button"
            onClick={() => updateQuery('list')}
            className={activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}
          >
            Lista
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr,1fr,1fr]">
          {alertCards.map((alert) => (
            <div
              key={alert.title}
              className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{alert.description}</p>
                </div>
                <span className={alert.count > 0 ? 'badge-red' : 'badge-gray'}>{alert.count}</span>
              </div>
              <Link href={alert.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-volve-700 hover:text-volve-800">
                Abrir lista
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>

      {activeTab === 'pipeline' ? (
        loading || !pipeline ? (
          <div className="card py-16 text-center text-sm text-slate-500">Carregando pipeline...</div>
        ) : (
          <>
            <KanbanBoard
              columns={pipeline.columns}
              movingLeadId={movingLeadId}
              onMove={handleMoveLead}
            />

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="card space-y-4">
                <div className="space-y-1">
                  <h2 className="section-title">Fechados ganhos</h2>
                  <p className="section-copy">
                    Leads que ja viraram cliente e sairam da esteira comercial.
                  </p>
                </div>
                {pipeline.closed.won.length === 0 ? (
                  <EmptyState
                    title="Nenhuma conversao ainda"
                    description="Assim que um lead fechar, ele aparece aqui com a ligacao para o cliente criado."
                  />
                ) : (
                  <div className="space-y-3">
                    {pipeline.closed.won.slice(0, 6).map((lead) => (
                      <div key={lead.id} className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
                            <p className="text-sm text-emerald-700">
                              {lead.client?.nome ?? 'Cliente convertido'}
                            </p>
                          </div>
                          <Link href={`/painel/clientes/${lead.id}`} className="text-sm font-semibold text-emerald-700">
                            Abrir
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card space-y-4">
                <div className="space-y-1">
                  <h2 className="section-title">Fechados perdidos</h2>
                  <p className="section-copy">
                    Motivos de perda mais recentes para ajustar discurso e cadencia.
                  </p>
                </div>
                {pipeline.closed.lost.length === 0 ? (
                  <EmptyState
                    title="Nenhuma perda registrada"
                    description="Quando um lead sair do pipeline como perdido, o motivo aparece aqui."
                  />
                ) : (
                  <div className="space-y-3">
                    {pipeline.closed.lost.slice(0, 6).map((lead) => (
                      <div key={lead.id} className="rounded-[22px] border border-rose-200 bg-rose-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
                            <p className="mt-1 text-sm text-rose-700">
                              {lead.lostReason || 'Sem motivo informado'}
                            </p>
                          </div>
                          <Link href={`/painel/clientes/${lead.id}`} className="text-sm font-semibold text-rose-700">
                            Abrir
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )
      ) : (
        <div className="space-y-4">
          <div className="card grid gap-4 xl:grid-cols-[2fr,1fr,1fr,auto]">
            <input
              type="search"
              placeholder="Buscar por nome, empresa, email ou telefone"
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="input"
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value as LeadStage | 'all')}
            >
              <option value="all">Todas as etapas</option>
              {Object.entries(LEAD_STAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as LeadSource | 'all')}
            >
              <option value="all">Todas as origens</option>
              {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={includeClosed}
                onChange={(event) => setIncludeClosed(event.target.checked)}
              />
              Incluir fechados
            </label>
          </div>

          {loading ? (
            <div className="card py-16 text-center text-sm text-slate-500">Carregando leads...</div>
          ) : leads.length === 0 ? (
            <EmptyState
              icon={<ClientsIcon className="h-6 w-6" />}
              title="Nenhum lead encontrado"
              description="Ajuste os filtros ou crie um novo lead para alimentar o pipeline comercial."
              action={
                <button type="button" onClick={() => setShowLeadModal(true)} className="btn-primary">
                  Novo lead
                </button>
              }
            />
          ) : (
            <LeadsList leads={leads} />
          )}
        </div>
      )}

      <ModalNovoLead
        open={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        onCreated={fetchData}
      />
    </div>
  )
}
