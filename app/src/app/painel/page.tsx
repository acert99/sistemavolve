import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

// Cartão de métrica
function MetricCard({
  label,
  value,
  sub,
  color = 'volve',
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  const colors: Record<string, string> = {
    volve:  'from-volve-600 to-volve-700',
    green:  'from-emerald-500 to-emerald-600',
    orange: 'from-orange-500 to-orange-600',
    red:    'from-red-500 to-red-600',
  }

  return (
    <div className={`rounded-xl bg-gradient-to-br ${colors[color]} p-6 text-white shadow-lg`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-2 text-4xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-70">{sub}</p>}
    </div>
  )
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  // Busca métricas em paralelo
  const [
    totalClientes,
    aprovacoesPendentes,
    propostasEnviadas,
    cobrancasVencidas,
    cobrancasPendentes,
  ] = await Promise.all([
    prisma.cliente.count({ where: { ativo: true } }),
    prisma.aprovacao.count({ where: { status: 'aguardando' } }),
    prisma.proposta.count({ where: { status: 'enviada' } }),
    prisma.cobranca.count({ where: { status: 'OVERDUE' } }),
    prisma.cobranca.aggregate({
      where: { status: 'PENDING' },
      _sum: { valor: true },
    }),
  ])

  const valorPendente = Number(cobrancasPendentes._sum?.valor ?? 0)

  // Atividade recente
  const aprovacaoRecente = await prisma.aprovacao.findMany({
    where: { status: 'aguardando' },
    include: {
      entrega: { select: { titulo: true } },
      cliente: { select: { nome: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {session?.user?.nome?.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Aqui está um resumo da plataforma.
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Clientes ativos"
          value={totalClientes}
          color="volve"
        />
        <MetricCard
          label="Aprovações pendentes"
          value={aprovacoesPendentes}
          sub="aguardando resposta"
          color={aprovacoesPendentes > 0 ? 'orange' : 'green'}
        />
        <MetricCard
          label="Propostas aguardando"
          value={propostasEnviadas}
          sub="enviadas sem resposta"
          color={propostasEnviadas > 0 ? 'orange' : 'green'}
        />
        <MetricCard
          label="Cobranças vencidas"
          value={cobrancasVencidas}
          sub={`R$ ${valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pendente`}
          color={cobrancasVencidas > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Aprovações pendentes */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Aprovações aguardando resposta
        </h2>
        {aprovacaoRecente.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            Nenhuma aprovação pendente. 🎉
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Entrega</th>
                  <th>Criada em</th>
                </tr>
              </thead>
              <tbody>
                {aprovacaoRecente.map((ap) => (
                  <tr key={ap.id}>
                    <td className="font-medium">{ap.cliente.nome}</td>
                    <td>{ap.entrega.titulo}</td>
                    <td className="text-gray-400">
                      {new Intl.DateTimeFormat('pt-BR').format(ap.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
