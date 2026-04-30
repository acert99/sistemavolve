import type { Metadata } from 'next'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { EmptyState } from '@/components/panel/empty-state'
import { MetricCard } from '@/components/panel/metric-card'
import { PageHeader } from '@/components/panel/page-header'
import { reportStatusLabel, reportTypeLabel } from '@/lib/client-reports'

export const metadata: Metadata = { title: 'Relatórios' }
export const dynamic = 'force-dynamic'

function fmt(date: Date) { return date.toLocaleDateString('pt-BR') }

export default async function RelatoriosPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const status = typeof searchParams?.status === 'string' && searchParams.status ? searchParams.status : undefined
  const reports = await prisma.clientReport.findMany({
    where: status ? { status: status as never } : {},
    include: { cliente: { select: { nome: true } }, _count: { select: { metrics: true, items: true, assets: true } } },
    orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    take: 80,
  })
  const counts = await prisma.clientReport.groupBy({ by: ['status'], _count: true })
  const total = reports.length
  const approved = counts.find((item) => item.status === 'approved')?._count ?? 0
  const draft = counts.find((item) => item.status === 'draft')?._count ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Relatórios de clientes"
        description="Histórico semanal e mensal salvo na plataforma Volve. Gere rascunhos, consolide o mês e crie PDFs para revisão antes de enviar ao cliente."
        meta={[{ label: 'Sem envio automático', tone: 'warning' }]}
        actions={<Link href="/painel/relatorios/novo" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Novo relatório</Link>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Relatórios listados" value={total} hint="Últimos registros" tone="neutral" />
        <MetricCard label="Rascunhos" value={draft} hint="Em construção" tone="warning" />
        <MetricCard label="Aprovados" value={approved} hint="Podem ser marcados como enviados" tone="success" />
      </div>

      {reports.length === 0 ? (
        <EmptyState title="Nenhum relatório criado" description="Crie o primeiro rascunho semanal ou mensal para começar a preservar o histórico do cliente." action={<Link href="/painel/relatorios/novo" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Criar relatório</Link>} />
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.3fr_0.7fr_0.8fr_0.7fr_0.5fr] gap-4 border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>Relatório</span><span>Cliente</span><span>Período</span><span>Status</span><span>Dados</span>
          </div>
          {reports.map((report) => (
            <Link key={report.id} href={`/painel/relatorios/${report.id}`} className="grid grid-cols-[1.3fr_0.7fr_0.8fr_0.7fr_0.5fr] gap-4 border-b border-slate-100 px-5 py-4 text-sm transition hover:bg-slate-50">
              <span className="font-semibold text-slate-900">{report.title}<br/><small className="font-normal text-slate-500">{reportTypeLabel(report.type)}</small></span>
              <span className="text-slate-600">{report.cliente.nome}</span>
              <span className="text-slate-600">{fmt(report.periodStart)} a {fmt(report.periodEnd)}</span>
              <span className="text-slate-600">{reportStatusLabel(report.status)}</span>
              <span className="text-slate-500">{report._count.metrics} métricas · {report._count.items} itens · {report._count.assets} assets</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
