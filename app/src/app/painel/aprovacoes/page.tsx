'use client'

import { useEffect, useState } from 'react'

interface Aprovacao {
  id: string
  status: string
  comentario: string | null
  createdAt: string
  aprovadoEm: string | null
  entrega: { titulo: string; status: string; arquivoUrl: string | null }
  cliente: { nome: string; email: string }
}

const statusBadge: Record<string, string> = {
  aguardando: 'badge-yellow',
  aprovado:   'badge-green',
  reprovado:  'badge-red',
}

const statusLabel: Record<string, string> = {
  aguardando: '⏳ Aguardando',
  aprovado:   '✅ Aprovado',
  reprovado:  '❌ Reprovado',
}

export default function AprovacoesPage() {
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([])
  const [statusFilter, setStatusFilter] = useState('aguardando')
  const [loading, setLoading] = useState(true)

  async function fetchAprovacoes(status: string) {
    setLoading(true)
    const res = await fetch(`/api/aprovacoes?status=${status}&limit=50`)
    const data = await res.json()
    if (data.success) setAprovacoes(data.data)
    setLoading(false)
  }

  useEffect(() => {
    fetchAprovacoes(statusFilter)
  }, [statusFilter])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Aprovações</h1>
        <p className="text-sm text-gray-500">
          Ciclo de aprovação de entregas pelos clientes
        </p>
      </div>

      {/* Filtro de status */}
      <div className="flex gap-2 mb-6">
        {['aguardando', 'aprovado', 'reprovado'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-volve-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {statusLabel[s]}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Carregando…</p>
        ) : aprovacoes.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            Nenhuma aprovação com status "{statusFilter}".
          </p>
        ) : (
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Entrega</th>
                <th>Status</th>
                <th>Comentário</th>
                <th>Criada</th>
                <th>Respondida</th>
                <th>Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {aprovacoes.map((ap) => (
                <tr key={ap.id}>
                  <td className="font-medium">{ap.cliente.nome}</td>
                  <td>{ap.entrega.titulo}</td>
                  <td>
                    <span className={statusBadge[ap.status] ?? 'badge-gray'}>
                      {statusLabel[ap.status] ?? ap.status}
                    </span>
                  </td>
                  <td className="max-w-xs truncate text-gray-500">
                    {ap.comentario ?? '—'}
                  </td>
                  <td className="text-gray-400">
                    {new Intl.DateTimeFormat('pt-BR').format(new Date(ap.createdAt))}
                  </td>
                  <td className="text-gray-400">
                    {ap.aprovadoEm
                      ? new Intl.DateTimeFormat('pt-BR').format(new Date(ap.aprovadoEm))
                      : '—'}
                  </td>
                  <td>
                    {ap.entrega.arquivoUrl ? (
                      <a
                        href={ap.entrega.arquivoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-volve-600 hover:underline text-xs"
                      >
                        Ver arquivo
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
