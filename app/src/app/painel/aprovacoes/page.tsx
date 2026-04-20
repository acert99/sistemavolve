'use client'

import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/panel/empty-state'
import { ApprovalIcon } from '@/components/panel/icons'
import { PageHeader } from '@/components/panel/page-header'
import { formatDateInAppTimeZone } from '@/lib/timezone'

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
  aprovado: 'badge-green',
  reprovado: 'badge-red',
}

const statusLabel: Record<string, string> = {
  aguardando: 'Aguardando',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Validacao"
        title="Aprovacoes"
        description="Acompanhe os retornos do cliente sem depender de conversa solta. O painel agora destaca melhor o que ainda trava a operacao."
        meta={[{ label: `Filtro: ${statusLabel[statusFilter] ?? statusFilter}` }]}
      />

      <div className="flex flex-wrap gap-2">
        {['aguardando', 'aprovado', 'reprovado'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={
              statusFilter === status
                ? 'btn-primary'
                : 'btn-secondary'
            }
          >
            {statusLabel[status]}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Carregando aprovacoes...</div>
        ) : aprovacoes.length === 0 ? (
          <EmptyState
            icon={<ApprovalIcon className="h-6 w-6" />}
            title="Nenhuma aprovacao nesse filtro"
            description={`Nao ha entregas com status "${statusLabel[statusFilter] ?? statusFilter}" neste momento.`}
          />
        ) : (
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Entrega</th>
                <th>Status</th>
                <th>Comentario</th>
                <th>Criada</th>
                <th>Respondida</th>
                <th>Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {aprovacoes.map((aprovacao) => (
                <tr key={aprovacao.id}>
                  <td className="font-medium">{aprovacao.cliente.nome}</td>
                  <td>{aprovacao.entrega.titulo}</td>
                  <td>
                    <span className={statusBadge[aprovacao.status] ?? 'badge-gray'}>
                      {statusLabel[aprovacao.status] ?? aprovacao.status}
                    </span>
                  </td>
                  <td className="max-w-xs truncate text-slate-500">
                    {aprovacao.comentario ?? '-'}
                  </td>
                  <td className="text-slate-500">
                    {formatDateInAppTimeZone(aprovacao.createdAt)}
                  </td>
                  <td className="text-slate-500">
                    {aprovacao.aprovadoEm
                      ? formatDateInAppTimeZone(aprovacao.aprovadoEm)
                      : '-'}
                  </td>
                  <td>
                    {aprovacao.entrega.arquivoUrl ? (
                      <a
                        href={aprovacao.entrega.arquivoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-volve-700 hover:text-volve-800"
                      >
                        Ver arquivo
                      </a>
                    ) : (
                      '-'
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
