'use client'

import { useEffect, useState } from 'react'

interface Cobranca {
  id: string
  descricao: string
  valor: string
  vencimento: string
  status: string
  tipo: string
  linkPagamento: string | null
  pixCopaCola: string | null
  pagoEm: string | null
}

const statusConfig: Record<string, { label: string; badge: string }> = {
  PENDING:  { label: 'Pendente',   badge: 'badge-yellow' },
  RECEIVED: { label: 'Pago',       badge: 'badge-green' },
  CONFIRMED:{ label: 'Confirmado', badge: 'badge-green' },
  OVERDUE:  { label: 'Vencido',    badge: 'badge-red' },
  REFUNDED: { label: 'Estornado',  badge: 'badge-gray' },
  RECEIVED_IN_CASH: { label: 'Pago em dinheiro', badge: 'badge-green' },
}

export default function ClienteFinanceiroPage() {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([])
  const [loading, setLoading] = useState(true)
  const [pixModal, setPixModal] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/cobrancas?limit=50')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCobrancas(data.data)
        setLoading(false)
      })
  }, [])

  const pendentes = cobrancas.filter((c) =>
    ['PENDING', 'OVERDUE'].includes(c.status),
  )
  const pagas = cobrancas.filter((c) =>
    ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(c.status),
  )

  const totalPendente = pendentes.reduce((acc, c) => acc + Number(c.valor), 0)

  function moeda(valor: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Financeiro</h1>
      <p className="text-gray-500 mb-8">Acompanhe suas cobranças e pagamentos.</p>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Carregando…</p>
      ) : (
        <>
          {/* Resumo */}
          {pendentes.length > 0 && (
            <div className="card bg-amber-50 border border-amber-200 mb-6">
              <p className="text-sm text-amber-700 font-medium">
                Você tem {pendentes.length} cobrança(s) em aberto no valor de{' '}
                <strong>{moeda(totalPendente)}</strong>
              </p>
            </div>
          )}

          {/* Cobranças pendentes */}
          {pendentes.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Em aberto</h2>
              <div className="space-y-3">
                {pendentes.map((c) => {
                  const cfg = statusConfig[c.status]
                  const isOverdue = c.status === 'OVERDUE'

                  return (
                    <div
                      key={c.id}
                      className={`card flex flex-col sm:flex-row sm:items-center
                                  sm:justify-between gap-4
                                  ${isOverdue ? 'border-l-4 border-l-red-400' : ''}`}
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{c.descricao}</p>
                        <p className="text-sm text-gray-500">
                          Vencimento:{' '}
                          {new Intl.DateTimeFormat('pt-BR').format(
                            new Date(c.vencimento),
                          )}{' '}
                          · {c.tipo}
                        </p>
                        <span className={cfg?.badge ?? 'badge-gray'}>
                          {cfg?.label ?? c.status}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-xl font-bold text-gray-900">
                          {moeda(Number(c.valor))}
                        </p>
                        <div className="flex gap-2">
                          {c.pixCopaCola && (
                            <button
                              onClick={() => setPixModal(c.pixCopaCola)}
                              className="btn-secondary text-xs py-1.5"
                            >
                              Copiar PIX
                            </button>
                          )}
                          {c.linkPagamento && (
                            <a
                              href={c.linkPagamento}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-primary text-xs py-1.5"
                            >
                              Pagar agora
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pagas */}
          {pagas.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Histórico de pagamentos</h2>
              <div className="card overflow-x-auto">
                <table className="table-auto w-full">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Valor</th>
                      <th>Pago em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagas.map((c) => (
                      <tr key={c.id}>
                        <td className="font-medium">{c.descricao}</td>
                        <td>{moeda(Number(c.valor))}</td>
                        <td className="text-gray-400">
                          {c.pagoEm
                            ? new Intl.DateTimeFormat('pt-BR').format(new Date(c.pagoEm))
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {cobrancas.length === 0 && (
            <div className="card text-center py-10">
              <p className="text-3xl mb-2">💚</p>
              <p className="text-gray-500">Nenhuma cobrança registrada.</p>
            </div>
          )}
        </>
      )}

      {/* Modal PIX copia e cola */}
      {pixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">PIX Copia e Cola</h2>
            <textarea
              readOnly
              rows={4}
              className="input text-xs font-mono resize-none mb-4"
              value={pixModal}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pixModal)
                  alert('Código PIX copiado!')
                }}
                className="btn-primary flex-1"
              >
                Copiar código
              </button>
              <button onClick={() => setPixModal(null)} className="btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
