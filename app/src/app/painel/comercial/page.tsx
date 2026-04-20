import Link from 'next/link'
import { differenceInDays, differenceInHours, subDays, subHours } from 'date-fns'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import type { LeadSource, LeadStage } from '@/types'
import { EmptyState } from '@/components/panel/empty-state'
import {
  ArrowRightIcon,
  ClientsIcon,
  CommercialIcon,
  CommunicationIcon,
  ProposalIcon,
} from '@/components/panel/icons'
import { MetricCard } from '@/components/panel/metric-card'
import { PageHeader } from '@/components/panel/page-header'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { formatDateTimeInAppTimeZone } from '@/lib/timezone'
import { LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS } from '../clientes/constants'

const ACTIVE_STAGES: LeadStage[] = ['new', 'contacted', 'meeting', 'proposal', 'negotiation']

function formatPercent(value: number) {
  return `${value.toFixed(0)}%`
}

function formatStageAge(days: number) {
  if (!Number.isFinite(days) || days <= 0) return 'Entrou hoje'
  if (days < 1) return 'Menos de 1 dia'
  if (days === 1) return '1 dia'
  return `${days.toFixed(1)} dias`
}

function buildSourceRows(params: {
  totals: Array<{ source: LeadSource; _count: number }>
  won: Array<{ source: LeadSource; _count: number }>
}) {
  const wonMap = new Map(params.won.map((item) => [item.source, item._count]))

  return params.totals
    .map((item) => {
      const wonCount = wonMap.get(item.source) ?? 0
      return {
        source: item.source,
        total: item._count,
        won: wonCount,
        rate: item._count > 0 ? (wonCount / item._count) * 100 : 0,
      }
    })
    .sort((left, right) => right.rate - left.rate || right.won - left.won)
}

export default async function ComercialPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    redirect('/auth/login')
  }

  const now = new Date()
  const thirtyDaysAgo = subDays(now, 30)
  const hotLeadThreshold = subHours(now, 2)
  const staleActionThreshold = subDays(now, 3)

  const [
    leadsInPipeline,
    hotLeads,
    overdueActions,
    proposalWaiting,
    failedJobs,
    won30d,
    lost30d,
    proposalTouched30d,
    wonFromProposal30d,
    stageCounts,
    activeLeadStageAges,
    sourceTotals,
    sourceWonTotals,
    lostReasons,
    urgentLeads,
  ] = await Promise.all([
    prisma.lead.count({
      where: { stage: { in: ACTIVE_STAGES } },
    }),
    prisma.lead.count({
      where: {
        stage: 'new',
        createdAt: { lt: hotLeadThreshold },
        timeline: { none: {} },
      },
    }),
    prisma.lead.count({
      where: {
        stage: { in: ACTIVE_STAGES },
        nextActionDate: { lt: now },
      },
    }),
    prisma.lead.count({
      where: {
        stage: 'proposal',
        stageChangedAt: { lt: subDays(now, 1) },
      },
    }),
    prisma.followUpJob.count({
      where: {
        status: 'failed',
        lead: {
          stage: { in: ACTIVE_STAGES },
        },
      },
    }),
    prisma.lead.count({
      where: {
        stage: 'won',
        stageChangedAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.lead.count({
      where: {
        stage: 'lost',
        stageChangedAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.lead.count({
      where: {
        timeline: {
          some: {
            type: 'proposal_sent',
            createdAt: { gte: thirtyDaysAgo },
          },
        },
      },
    }),
    prisma.lead.count({
      where: {
        stage: 'won',
        stageChangedAt: { gte: thirtyDaysAgo },
        timeline: {
          some: {
            type: 'proposal_sent',
          },
        },
      },
    }),
    prisma.lead.groupBy({
      by: ['stage'],
      _count: true,
      where: {
        stage: { in: ACTIVE_STAGES },
      },
    }),
    prisma.lead.findMany({
      where: {
        stage: { in: ACTIVE_STAGES },
      },
      select: {
        stage: true,
        stageChangedAt: true,
      },
    }),
    prisma.lead.groupBy({
      by: ['source'],
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ['source'],
      _count: true,
      where: {
        stage: 'won',
      },
    }),
    prisma.lead.groupBy({
      by: ['lostReason'],
      _count: true,
      where: {
        stage: 'lost',
        lostReason: { not: null },
      },
      orderBy: {
        _count: {
          lostReason: 'desc',
        },
      },
      take: 6,
    }),
    prisma.lead.findMany({
      where: {
        OR: [
          {
            stage: 'new',
            createdAt: { lt: hotLeadThreshold },
            timeline: { none: {} },
          },
          {
            stage: { in: ACTIVE_STAGES },
            nextActionDate: { lt: staleActionThreshold },
          },
          {
            stage: 'proposal',
            stageChangedAt: { lt: subDays(now, 3) },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        stage: true,
        source: true,
        company: true,
        nextAction: true,
        nextActionDate: true,
        stageChangedAt: true,
        createdAt: true,
      },
      orderBy: [{ nextActionDate: 'asc' }, { stageChangedAt: 'asc' }, { createdAt: 'asc' }],
      take: 8,
    }),
  ])

  const decided30d = won30d + lost30d
  const conversionRate30d = decided30d > 0 ? (won30d / decided30d) * 100 : 0
  const proposalToWon30d =
    proposalTouched30d > 0 ? (wonFromProposal30d / proposalTouched30d) * 100 : 0
  const urgentTotal = hotLeads + overdueActions + proposalWaiting + failedJobs

  const stageAgeRows = ACTIVE_STAGES.map((stage) => {
    const items = activeLeadStageAges.filter((item) => item.stage === stage)
    const totalDays = items.reduce(
      (sum, item) => sum + Math.max(0, differenceInHours(now, item.stageChangedAt)) / 24,
      0,
    )

    return {
      stage,
      count: stageCounts.find((item) => item.stage === stage)?._count ?? 0,
      avgDays: items.length > 0 ? totalDays / items.length : 0,
    }
  })

  const sourceRows = buildSourceRows({
    totals: sourceTotals.map((item) => ({
      source: item.source as LeadSource,
      _count: item._count,
    })),
    won: sourceWonTotals.map((item) => ({
      source: item.source as LeadSource,
      _count: item._count,
    })),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercial"
        title="Metricas e gargalos do pipeline"
        description="Leia o ritmo do funil em um lugar so: volume por etapa, urgencias, conversao e motivos de perda para ajustar a operacao comercial com menos achismo."
        meta={[
          { label: `${leadsInPipeline} lead(s) ativos` },
          {
            label: `${urgentTotal} alerta(s) comerciais`,
            tone: urgentTotal > 0 ? 'warning' : 'success',
          },
          {
            label: `${formatPercent(conversionRate30d)} de conversao em 30 dias`,
            tone: conversionRate30d >= 40 ? 'success' : conversionRate30d > 0 ? 'warning' : 'default',
          },
        ]}
        actions={
          <>
            <Link href="/painel/clientes" className="btn-secondary">
              Abrir CRM
            </Link>
            <Link href="/painel/propostas" className="btn-primary">
              Ver propostas
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          label="Leads no pipeline"
          value={leadsInPipeline}
          hint="Etapas abertas entre novo lead e negociacao."
          tone="volve"
          icon={<ClientsIcon className="h-5 w-5" />}
          href="/painel/clientes"
        />
        <MetricCard
          label="Acao comercial urgente"
          value={urgentTotal}
          hint={`${hotLeads} sem contato, ${overdueActions} atrasados, ${proposalWaiting} em silencio.`}
          tone={urgentTotal > 0 ? 'warning' : 'success'}
          icon={<CommunicationIcon className="h-5 w-5" />}
          href="/painel/clientes?tab=list"
        />
        <MetricCard
          label="Conversao 30 dias"
          value={formatPercent(conversionRate30d)}
          hint={`${won30d} ganho(s) contra ${lost30d} perdido(s).`}
          tone={conversionRate30d >= 40 ? 'success' : conversionRate30d > 0 ? 'warning' : 'neutral'}
          icon={<CommercialIcon className="h-5 w-5" />}
        />
        <MetricCard
          label="Proposta -> ganho"
          value={formatPercent(proposalToWon30d)}
          hint={`${wonFromProposal30d} fechamento(s) a partir de ${proposalTouched30d} lead(s) com proposta.`}
          tone={proposalToWon30d >= 35 ? 'success' : proposalToWon30d > 0 ? 'warning' : 'neutral'}
          icon={<ProposalIcon className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <section className="card space-y-5">
          <div className="space-y-2">
            <h2 className="section-title">Fila comercial urgente</h2>
            <p className="section-copy">
              Leads que precisam de contato, definicao ou recuperacao agora.
            </p>
          </div>

          {urgentLeads.length === 0 ? (
            <EmptyState
              icon={<CommunicationIcon className="h-6 w-6" />}
              title="Nenhum lead pedindo acao imediata"
              description="O CRM nao encontrou leads sem contato, atrasados ou com proposta esfriando neste momento."
            />
          ) : (
            <div className="space-y-3">
              {urgentLeads.map((lead) => {
                const stageAge = differenceInDays(now, lead.stageChangedAt)
                const isHotLead = lead.stage === 'new' && differenceInHours(now, lead.createdAt) >= 2
                const isOverdueAction =
                  !!lead.nextActionDate && lead.nextActionDate < staleActionThreshold
                const isProposalCooling =
                  lead.stage === 'proposal' && differenceInDays(now, lead.stageChangedAt) >= 3

                return (
                  <Link
                    key={lead.id}
                    href={`/painel/clientes/${lead.id}`}
                    className="flex items-start justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4 transition-colors hover:bg-slate-100/80"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
                        <span className="badge-gray">{LEAD_STAGE_LABELS[lead.stage]}</span>
                        <span className="badge-blue">{LEAD_SOURCE_LABELS[lead.source]}</span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {lead.company || 'Sem empresa informada'}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {isHotLead ? <span className="badge-red">Sem contato ha 2h+</span> : null}
                        {isOverdueAction ? <span className="badge-red">Acao vencida ha 3+ dias</span> : null}
                        {isProposalCooling ? <span className="badge-yellow">Proposta esfriando</span> : null}
                        {!isHotLead && !isOverdueAction && !isProposalCooling ? (
                          <span className="badge-gray">Etapa parada ha {formatStageAge(stageAge)}</span>
                        ) : null}
                      </div>
                      {lead.nextAction ? (
                        <p className="text-sm text-slate-600">
                          Proxima acao: {lead.nextAction}
                          {lead.nextActionDate
                            ? ` · ${formatDateTimeInAppTimeZone(lead.nextActionDate)}`
                            : ''}
                        </p>
                      ) : null}
                    </div>
                    <ArrowRightIcon className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <section className="card space-y-5">
          <div className="space-y-2">
            <h2 className="section-title">Motivos de perda</h2>
            <p className="section-copy">
              Use esse quadro para ajustar oferta, discurso e timing do follow-up.
            </p>
          </div>

          {lostReasons.length === 0 ? (
            <EmptyState
              title="Nenhuma perda classificada ainda"
              description="Quando a equipe registrar motivos ao encerrar leads, eles aparecem aqui para leitura rapida."
            />
          ) : (
            <div className="space-y-3">
              {lostReasons.map((item) => (
                <div
                  key={item.lostReason ?? 'sem-motivo'}
                  className="flex items-center justify-between gap-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.lostReason ?? 'Sem motivo informado'}
                    </p>
                    <p className="text-sm text-rose-700">
                      {item._count} lead(s) marcados assim
                    </p>
                  </div>
                  <span className="badge-red">{item._count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <section className="card space-y-5">
          <div className="space-y-2">
            <h2 className="section-title">Ritmo por etapa</h2>
            <p className="section-copy">
              Leitura do volume atual e do tempo medio que cada lead esta parado na etapa.
            </p>
          </div>

          <div className="space-y-3">
            {stageAgeRows.map((row) => (
              <div
                key={row.stage}
                className="flex items-center justify-between gap-4 rounded-[22px] border border-slate-200 bg-white px-4 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {LEAD_STAGE_LABELS[row.stage]}
                  </p>
                  <p className="text-sm text-slate-500">
                    Tempo medio atual na etapa: {formatStageAge(row.avgDays)}
                  </p>
                </div>
                <span className={row.count > 0 ? 'badge-blue' : 'badge-gray'}>
                  {row.count} lead(s)
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card space-y-5">
          <div className="space-y-2">
            <h2 className="section-title">Origens que mais convertem</h2>
            <p className="section-copy">
              Compare volume total com fechamentos para decidir onde insistir e onde corrigir rota.
            </p>
          </div>

          {sourceRows.length === 0 ? (
            <EmptyState
              title="Nenhuma origem registrada"
              description="Os indicadores por origem aparecem assim que o CRM acumular leads suficientes."
            />
          ) : (
            <div className="space-y-3">
              {sourceRows.map((row) => (
                <div
                  key={row.source}
                  className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {LEAD_SOURCE_LABELS[row.source]}
                      </p>
                      <p className="text-sm text-slate-500">
                        {row.won} ganho(s) em {row.total} lead(s)
                      </p>
                    </div>
                    <span className={row.rate >= 35 ? 'badge-green' : row.rate > 0 ? 'badge-yellow' : 'badge-gray'}>
                      {formatPercent(row.rate)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
