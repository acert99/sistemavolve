import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { PageHeader } from '@/components/panel/page-header'
import { buildReportMarkdown, reportStatusLabel, reportTypeLabel } from '@/lib/client-reports'
import { ReportActions } from '@/app/painel/relatorios/components/ReportActions'
import { ReportEditor } from '@/app/painel/relatorios/components/ReportEditor'

export const metadata: Metadata = { title: 'Relatório' }
export const dynamic = 'force-dynamic'

function fmt(date: Date) { return date.toLocaleDateString('pt-BR') }

const typeLabels: Record<string, string> = {
  published_content: 'Conteúdos publicados',
  pending_client: 'Pendências do cliente',
  in_progress: 'Em andamento',
  highlight: 'Destaques',
  risk: 'Riscos',
  next_action: 'Próximas ações',
  delayed: 'Atrasos',
  strategic_note: 'Notas estratégicas',
}

export default async function RelatorioDetalhePage({ params }: { params: { id: string } }) {
  const report = await prisma.clientReport.findUnique({
    where: { id: params.id },
    include: { cliente: true, metrics: { orderBy: { createdAt: 'asc' } }, items: { orderBy: [{ type: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'asc' }] }, assets: { orderBy: { createdAt: 'desc' } } },
  })
  if (!report) notFound()
  const markdown = buildReportMarkdown(report)
  const grouped = report.items.reduce<Record<string, typeof report.items>>((acc, item) => {
    acc[item.type] = acc[item.type] ?? []
    acc[item.type].push(item)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Relatórios"
        title={report.title}
        description={`${report.cliente.nome} · ${reportTypeLabel(report.type)} · ${fmt(report.periodStart)} a ${fmt(report.periodEnd)}`}
        meta={[{ label: reportStatusLabel(report.status), tone: report.status === 'approved' ? 'success' : report.status === 'sent' ? 'default' : 'warning' }]}
        actions={<Link href="/painel/relatorios" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Voltar</Link>}
      />

      <ReportActions reportId={report.id} type={report.type} status={report.status} />
      <ReportEditor report={JSON.parse(JSON.stringify(report))} />

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Métricas</h2>
          {report.metrics.length === 0 ? <p className="text-sm text-slate-500">Nenhuma métrica preenchida.</p> : report.metrics.map((metric) => (
            <div key={metric.id} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{metric.label}</p>
              <p className="text-2xl font-semibold text-slate-950">{metric.value === null ? 'sem dados' : `${Number(metric.value).toLocaleString('pt-BR')}${metric.unit ? ` ${metric.unit}` : ''}`}</p>
              <p className="text-xs text-slate-500">Fonte: {metric.source}{metric.previousValue ? ` · anterior: ${Number(metric.previousValue).toLocaleString('pt-BR')}` : ' · sem base anterior'}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Itens do relatório</h2>
          {Object.keys(grouped).length === 0 ? <p className="text-sm text-slate-500">Nenhum item registrado.</p> : Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{typeLabels[type] ?? type}</h3>
              {items.map((item) => <div key={item.id} className="rounded-2xl border border-slate-100 p-4"><p className="font-semibold text-slate-900">{item.title}</p><p className="text-sm text-slate-500">{item.description || item.status || 'Sem descrição'}</p></div>)}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Prévia imprimível</h2>
          <p className="text-xs text-slate-500">Use o botão “Gerar PDF” acima para salvar um asset.</p>
        </div>
        <pre className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-700">{markdown}</pre>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Assets gerados</h2>
        {report.assets.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nenhum arquivo gerado ainda.</p> : <div className="mt-3 space-y-2">{report.assets.map((asset) => <a key={asset.id} href={asset.publicUrl ?? '#'} className="block rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{asset.filename} · {asset.type}</a>)}</div>}
      </section>
    </div>
  )
}
