import type { Metadata } from 'next'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { PageHeader } from '@/components/panel/page-header'
import { NewReportForm } from '@/app/painel/relatorios/novo/report-form'

export const metadata: Metadata = { title: 'Novo relatório' }
export const dynamic = 'force-dynamic'

export default async function NovoRelatorioPage() {
  const clientes = await prisma.cliente.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } })
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Relatórios"
        title="Novo relatório"
        description="Crie um rascunho semanal ou mensal. O relatório fica salvo no banco e não é enviado para cliente automaticamente."
        actions={<Link href="/painel/relatorios" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Voltar</Link>}
      />
      <NewReportForm clientes={clientes} />
    </div>
  )
}
