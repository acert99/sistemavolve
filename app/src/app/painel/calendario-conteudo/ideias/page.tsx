import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/panel/page-header'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import IdeasClient from './ui'

export const dynamic = 'force-dynamic'

export default async function ContentCalendarIdeasPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')
  if (session.user.perfil !== 'equipe') redirect('/painel')

  const clients = await prisma.cliente.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
    take: 200,
  })

  return (
    <main className="space-y-8">
      <PageHeader
        eyebrow="Conteudo"
        title="Ideias — Calendario de Conteudo"
        description="Gere ideias por cliente/mês, aprove/reprove uma a uma e depois gere o PDF final. (MVP: geracao placeholder)"
      />

      <IdeasClient clients={clients} />
    </main>
  )
}
