import Link from 'next/link'
import type { Metadata } from 'next'
import { subDays, subHours } from 'date-fns'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { EmptyState } from '@/components/panel/empty-state'
import {
  ApprovalIcon,
  ArrowRightIcon,
  BillingIcon,
  CommercialIcon,
  CommunicationIcon,
  ContractIcon,
  ClientsIcon,
  ProposalIcon,
  TasksIcon,
  WhatsAppIcon,
} from '@/components/panel/icons'
import { MetricCard } from '@/components/panel/metric-card'
import { PageHeader } from '@/components/panel/page-header'
import {
  formatDateInAppTimeZone,
  formatDateTimeInAppTimeZone,
  getAppDayRange,
} from '@/lib/timezone'
import { getInstanceStatus } from '@/lib/whatsapp'

export const metadata: Metadata = { title: 'Dashboard' }

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const { start: startToday, end: endToday } = getAppDayRange()
  const now = new Date()

  const [
    totalClientes,
    aprovacoesPendentes,
    propostasAbertas,
    contratosAssinatura,
    leadsNoPipeline,
    leadsQuentes,
    acoesComerciaisVencidas,
    propostasSemResposta,
    jobsComerciaisFalhos,
    tarefasAtivas,
    cobrancasCriticas,
    valorEmAberto,
    aprovacoesRecentes,
    cobrancasVencidas,
    whatsappStatus,
  ] = await Promise.all([
    prisma.cliente.count({ where: { ativo: true } }),
    prisma.aprovacao.count({ where: { status: 'aguardando' } }),
    prisma.proposta.count({
      where: { status: { in: ['enviada', 'visualizada'] } },
    }),
    prisma.contrato.count({
      where: { status: { in: ['pendente', 'enviado'] } },
    }),
    prisma.lead.count({
      where: { stage: { in: ['new', 'contacted', 'meeting', 'proposal', 'negotiation'] } },
    }),
    prisma.lead.count({
      where: {
        stage: 'new',
        createdAt: { lt: subHours(now, 2) },
        timeline: { none: {} },
      },
    }),
    prisma.lead.count({
      where: {
        stage: { in: ['new', 'contacted', 'meeting', 'proposal', 'negotiation'] },
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
          stage: { in: ['new', 'contacted', 'meeting', 'proposal', 'negotiation'] },
        },
      },
    }),
    prisma.entrega.count({
      where: { status: { in: ['em_producao', 'aguardando_aprovacao'] } },
    }),
    prisma.cobranca.count({
      where: { status: { in: ['PENDING', 'OVERDUE'] } },
    }),
    prisma.cobranca.aggregate({
      where: { status: { in: ['PENDING', 'OVERDUE'] } },
      _sum: { valor: true },
    }),
    prisma.aprovacao.findMany({
      where: { status: 'aguardando' },
      include: {
        entrega: { select: { titulo: true } },
        cliente: { select: { nome: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.cobranca.findMany({
      where: { status: 'OVERDUE' },
      include: {
        cliente: { select: { nome: true } },
      },
      orderBy: { vencimento: 'asc' },
      take: 4,
    }),
    getInstanceStatus(),
  ])

  let mensagensHoje = 0
  let proximasMensagens: Array<{
    id: string
    agendadoPara: Date
    conteudoMensagem: string
    cliente: { nome: string; whatsapp: string | null }
    template: { nome: string } | null
  }> = []

  try {
    ;[mensagensHoje, proximasMensagens] = await Promise.all([
      prisma.mensagemAgendada.count({
        where: {
          status: 'scheduled',
          agendadoPara: {
            gte: startToday,
            lt: endToday,
          },
        },
      }),
      prisma.mensagemAgendada.findMany({
        where: {
          status: 'scheduled',
          agendadoPara: { gte: now },
        },
        include: {
          cliente: { select: { nome: true, whatsapp: true } },
          template: { select: { nome: true } },
        },
        orderBy: { agendadoPara: 'asc' },
        take: 4,
      }),
    ])
  } catch (err) {
    console.warn('[Dashboard] Modulo de comunicacao ainda nao aplicado no banco:', err)
  }

  const valorAberto = Number(valorEmAberto._sum?.valor ?? 0)
  const urgenciaComercial =
    leadsQuentes + acoesComerciaisVencidas + propostasSemResposta + jobsComerciaisFalhos

  const alerts = [
    urgenciaComercial > 0
      ? {
          tone: 'warning',
          title: `${urgenciaComercial} alerta(s) no CRM`,
          description:
            'Ha leads sem contato, follow-ups vencidos ou propostas esfriando no pipeline comercial.',
          href: '/painel/clientes?tab=list',
        }
      : null,
    !whatsappStatus.connected
      ? {
          tone: 'warning',
          title: 'Canal WhatsApp precisa de atencao',
          description: `Estado atual: ${whatsappStatus.status}. Revise o modulo de Comunicacao antes de depender de envios.`,
          href: '/painel/comunicacao',
        }
      : null,
    cobrancasCriticas > 0
      ? {
          tone: 'danger',
          title: `${cobrancasCriticas} cobranca(s) em aberto`,
          description: 'Priorize recuperacao financeira e follow-up com clientes.',
          href: '/painel/cobrancas',
        }
      : null,
    aprovacoesPendentes > 0
      ? {
          tone: 'warning',
          title: `${aprovacoesPendentes} aprovacao(oes) aguardando cliente`,
          description: 'Ha entregas prontas que ainda travam o fluxo.',
          href: '/painel/aprovacoes',
        }
      : null,
    mensagensHoje > 0
      ? {
          tone: 'default',
          title: `${mensagensHoje} mensagem(ns) prevista(s) para hoje`,
          description: 'Revise os agendamentos antes do horario combinado.',
          href: '/painel/comunicacao',
        }
      : null,
  ].filter(Boolean) as Array<{
    tone: 'default' | 'warning' | 'danger'
    title: string
    description: string
    href: string
  }>

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Centro de comando"
        title={`Ola, ${session?.user?.nome?.split(' ')[0] ?? 'time'}`}
        description="O dashboard agora atua como torre de controle da operacao: comercial, contratos, cobrancas, tarefas, aprovacoes e comunicacao aparecem juntos para reduzir troca de contexto."
        meta={[
          { label: `${totalClientes} clientes ativos` },
          {
            label: whatsappStatus.connected ? 'WhatsApp conectado' : 'WhatsApp pendente',
            tone: whatsappStatus.connected ? 'success' : 'warning',
          },
        ]}
        actions={
          <>
          <Link href="/painel/tarefas" className="btn-secondary">
            Ver tarefas
          </Link>
            <Link href="/painel/clientes" className="btn-secondary">
              Abrir CRM
            </Link>
            <Link href="/painel/comunicacao" className="btn-primary">
              Abrir comunicacao
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          label="Leads no pipeline"
          value={leadsNoPipeline}
          hint="Pipeline comercial aberto entre contato, reunioes e propostas."
          tone={leadsNoPipeline > 0 ? 'volve' : 'neutral'}
          icon={<ClientsIcon className="h-5 w-5" />}
          href="/painel/clientes"
        />
        <MetricCard
          label="Acao comercial urgente"
          value={urgenciaComercial}
          hint={`${leadsQuentes} sem contato, ${acoesComerciaisVencidas} atrasados, ${propostasSemResposta} propostas em silencio.`}
          tone={urgenciaComercial > 0 ? 'warning' : 'success'}
          icon={<CommercialIcon className="h-5 w-5" />}
          href="/painel/comercial"
        />
        <MetricCard
          label="Propostas aguardando"
          value={propostasAbertas}
          hint="Rascunhos enviados ou visualizados sem resposta."
          tone={propostasAbertas > 0 ? 'warning' : 'neutral'}
          icon={<ProposalIcon className="h-5 w-5" />}
          href="/painel/propostas"
        />
        <MetricCard
          label="Contratos em assinatura"
          value={contratosAssinatura}
          hint="Pendencias que ainda travam onboarding e faturamento."
          tone={contratosAssinatura > 0 ? 'warning' : 'neutral'}
          icon={<ContractIcon className="h-5 w-5" />}
          href="/painel/contratos"
        />
        <MetricCard
          label="Cobrancas em aberto"
          value={cobrancasCriticas}
          hint={`${formatCurrency(valorAberto)} esperando pagamento.`}
          tone={cobrancasCriticas > 0 ? 'danger' : 'success'}
          icon={<BillingIcon className="h-5 w-5" />}
          href="/painel/cobrancas"
        />
        <MetricCard
          label="Aprovacoes pendentes"
          value={aprovacoesPendentes}
          hint="Entregas que dependem de resposta do cliente."
          tone={aprovacoesPendentes > 0 ? 'warning' : 'success'}
          icon={<ApprovalIcon className="h-5 w-5" />}
          href="/painel/aprovacoes"
        />
        <MetricCard
          label="Tarefas em andamento"
          value={tarefasAtivas}
          hint="Cards ativos entre producao e revisao."
          tone={tarefasAtivas > 0 ? 'volve' : 'neutral'}
          icon={<TasksIcon className="h-5 w-5" />}
          href="/painel/tarefas"
        />
        <MetricCard
          label="Mensagens previstas hoje"
          value={mensagensHoje}
          hint="Agenda manual preparada para follow-ups e avisos."
          tone={mensagensHoje > 0 ? 'volve' : 'neutral'}
          icon={<CommunicationIcon className="h-5 w-5" />}
          href="/painel/comunicacao"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <section className="card space-y-5">
          <div className="space-y-2">
            <h2 className="section-title">Acao comercial necessaria</h2>
            <p className="section-copy">
              Leads que pedem toque humano ou revisao imediata para nao esfriar o pipeline.
            </p>
          </div>

          {urgenciaComercial === 0 ? (
            <EmptyState
              icon={<CommercialIcon className="h-6 w-6" />}
              title="Comercial em dia"
              description="O painel nao encontrou leads sem contato, follow-ups vencidos ou jobs falhos no CRM."
              action={
                <Link href="/painel/clientes" className="btn-primary">
                  Abrir CRM
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {[
                {
                  label: 'Leads sem contato ha 2h+',
                  count: leadsQuentes,
                  tone: leadsQuentes > 0 ? 'badge-red' : 'badge-gray',
                },
                {
                  label: 'Proximas acoes vencidas',
                  count: acoesComerciaisVencidas,
                  tone: acoesComerciaisVencidas > 0 ? 'badge-red' : 'badge-gray',
                },
                {
                  label: 'Propostas sem resposta',
                  count: propostasSemResposta,
                  tone: propostasSemResposta > 0 ? 'badge-yellow' : 'badge-gray',
                },
                {
                  label: 'Jobs de follow-up falhos',
                  count: jobsComerciaisFalhos,
                  tone: jobsComerciaisFalhos > 0 ? 'badge-red' : 'badge-gray',
                },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.label === 'Jobs de follow-up falhos' ? '/painel/comercial' : '/painel/clientes?tab=list'}
                  className="flex items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4 transition-colors hover:bg-slate-100/80"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="text-sm text-slate-500">
                      Priorize esse bloco para o CRM andar sem depender de memoria.
                    </p>
                  </div>
                  <span className={item.tone}>{item.count}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card space-y-5">
          <div className="space-y-2">
            <h2 className="section-title">Alertas operacionais</h2>
            <p className="section-copy">
              Sinais que pedem acao rapida da equipe para a operacao nao ficar travada.
            </p>
          </div>

          {alerts.length === 0 ? (
            <EmptyState
              icon={<WhatsAppIcon className="h-6 w-6" />}
              title="Sem alertas criticos agora"
              description="O painel nao identificou gargalos urgentes entre comunicacao, aprovacoes e financeiro neste momento."
            />
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <Link
                  key={alert.title}
                  href={alert.href}
                  className={`flex items-start justify-between gap-4 rounded-[24px] border px-4 py-4 transition-colors ${
                    alert.tone === 'danger'
                      ? 'border-rose-200 bg-rose-50 hover:bg-rose-100/80'
                      : alert.tone === 'warning'
                        ? 'border-amber-200 bg-amber-50 hover:bg-amber-100/80'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                    <p className="text-sm leading-6 text-slate-600">{alert.description}</p>
                  </div>
                  <ArrowRightIcon className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr,0.95fr]">
        <section className="card space-y-5">
          <div className="space-y-2">
            <h2 className="section-title">Agenda de comunicacao</h2>
            <p className="section-copy">
              Proximos toques planejados para nao depender de memoria ou mensagem solta.
            </p>
          </div>

          {proximasMensagens.length === 0 ? (
            <EmptyState
              icon={<CommunicationIcon className="h-6 w-6" />}
              title="Nenhuma mensagem programada"
              description="Crie agendamentos manuais para follow-up comercial, assinatura de contrato ou cobranca."
              action={
                <Link href="/painel/comunicacao" className="btn-primary">
                  Abrir comunicacao
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {proximasMensagens.map((mensagem) => (
                <div
                  key={mensagem.id}
                  className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {mensagem.cliente.nome}
                      </p>
                      <p className="text-sm text-slate-500">
                        {mensagem.template?.nome ?? 'Mensagem livre'}
                      </p>
                    </div>
                    <span className="badge-blue">
                      {formatDateTimeInAppTimeZone(mensagem.agendadoPara)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {mensagem.conteudoMensagem}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <section className="card space-y-5">
          <div className="space-y-2">
            <h2 className="section-title">Aprovacoes aguardando resposta</h2>
            <p className="section-copy">
              Entregas que ja chegaram na ponta do cliente e ainda precisam destravar o proximo passo.
            </p>
          </div>

          {aprovacoesRecentes.length === 0 ? (
            <EmptyState
              icon={<ApprovalIcon className="h-6 w-6" />}
              title="Nenhuma aprovacao pendente"
              description="Quando a equipe enviar entregas para revisao, elas aparecerao aqui com contexto suficiente para agir rapido."
            />
          ) : (
            <div className="space-y-3">
              {aprovacoesRecentes.map((aprovacao) => (
                <div
                  key={aprovacao.id}
                  className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {aprovacao.cliente.nome}
                      </p>
                      <p className="text-sm text-slate-500">{aprovacao.entrega.titulo}</p>
                    </div>
                    <span className="badge-yellow">
                      {formatDateInAppTimeZone(aprovacao.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card space-y-5">
          <div className="space-y-2">
            <h2 className="section-title">Financeiro sob observacao</h2>
            <p className="section-copy">
              Cobrancas vencidas que merecem contato e renegociacao antes de virar problema maior.
            </p>
          </div>

          {cobrancasVencidas.length === 0 ? (
            <EmptyState
              icon={<BillingIcon className="h-6 w-6" />}
              title="Nenhuma cobranca vencida"
              description="Quando houver atrasos, este bloco vira um atalho para o time financeiro agir sem procurar em outras telas."
            />
          ) : (
            <div className="space-y-3">
              {cobrancasVencidas.map((cobranca) => (
                <div
                  key={cobranca.id}
                  className="rounded-[24px] border border-rose-200 bg-rose-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {cobranca.cliente.nome}
                      </p>
                      <p className="text-sm text-slate-600">{cobranca.descricao}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-rose-700">
                        {formatCurrency(Number(cobranca.valor))}
                      </p>
                      <p className="text-xs text-rose-700/80">
                        Venceu em{' '}
                        {formatDateInAppTimeZone(cobranca.vencimento)}
                      </p>
                    </div>
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
