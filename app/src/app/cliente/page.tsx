import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Início — Portal do Cliente' }

export default async function ClienteHomePage() {
  const session = await getServerSession(authOptions)
  const clienteId = session?.user?.clienteId

  if (!clienteId) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Conta não vinculada a um cliente. Contate a equipe Volve.</p>
      </div>
    )
  }

  const [aprovacoesPendentes, propostasAbertas, cobrancasPendentes] =
    await Promise.all([
      prisma.aprovacao.count({
        where: { clienteId, status: 'aguardando' },
      }),
      prisma.proposta.count({
        where: { clienteId, status: { in: ['enviada', 'visualizada'] } },
      }),
      prisma.cobranca.count({
        where: { clienteId, status: { in: ['PENDING', 'OVERDUE'] } },
      }),
    ])

  const alertas: { label: string; href: string; urgent: boolean }[] = []

  if (aprovacoesPendentes > 0) {
    alertas.push({
      label: `${aprovacoesPendentes} entrega(s) aguardando sua aprovação`,
      href: '/cliente/aprovacoes',
      urgent: true,
    })
  }

  if (propostasAbertas > 0) {
    alertas.push({
      label: `${propostasAbertas} proposta(s) aguardando resposta`,
      href: '/cliente/propostas',
      urgent: false,
    })
  }

  if (cobrancasPendentes > 0) {
    alertas.push({
      label: `${cobrancasPendentes} cobrança(s) em aberto`,
      href: '/cliente/financeiro',
      urgent: true,
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Bem-vindo, {session?.user?.nome?.split(' ')[0]}!
      </h1>
      <p className="text-gray-500 mb-8">
        Aqui você acompanha tudo relacionado ao seu projeto com a Volve.
      </p>

      {alertas.length > 0 && (
        <div className="space-y-3 mb-8">
          {alertas.map((alerta) => (
            <a
              key={alerta.href}
              href={alerta.href}
              className={`flex items-center justify-between rounded-xl p-4 ${
                alerta.urgent
                  ? 'bg-amber-50 border border-amber-200 text-amber-800'
                  : 'bg-blue-50 border border-blue-200 text-blue-800'
              }`}
            >
              <span className="font-medium text-sm">{alerta.label}</span>
              <span className="text-xs">Ver →</span>
            </a>
          ))}
        </div>
      )}

      {alertas.length === 0 && (
        <div className="card text-center py-10 mb-8">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-gray-600 font-medium">Tudo em dia!</p>
          <p className="text-gray-400 text-sm mt-1">Nenhuma ação pendente no momento.</p>
        </div>
      )}

      {/* Acesso rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { href: '/cliente/aprovacoes', label: 'Aprovações',  icon: '✅', count: aprovacoesPendentes },
          { href: '/cliente/propostas',  label: 'Propostas',   icon: '📄', count: propostasAbertas },
          { href: '/cliente/contratos',  label: 'Contratos',   icon: '📝', count: 0 },
          { href: '/cliente/financeiro', label: 'Financeiro',  icon: '💰', count: cobrancasPendentes },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="card flex flex-col items-center text-center py-6 hover:shadow-card-hover transition-shadow"
          >
            <span className="text-3xl mb-2">{item.icon}</span>
            <span className="text-sm font-medium text-gray-700">{item.label}</span>
            {item.count > 0 && (
              <span className="mt-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {item.count}
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}
