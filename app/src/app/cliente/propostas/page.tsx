'use client'

import { useEffect, useState } from 'react'
import { formatDateInAppTimeZone } from '@/lib/timezone'

interface Proposta {
  id: string
  titulo: string
  descricao: string | null
  valorTotal: string
  status: string
  token: string
  validade: string | null
  createdAt: string
  aceitoEm: string | null
}

const statusConfig: Record<string, { label: string; badge: string }> = {
  rascunho:   { label: 'Rascunho',   badge: 'badge-gray' },
  enviada:    { label: 'Aguardando', badge: 'badge-blue' },
  visualizada:{ label: 'Visualizada',badge: 'badge-yellow' },
  aceita:     { label: 'Aceita',     badge: 'badge-green' },
  recusada:   { label: 'Recusada',   badge: 'badge-red' },
  expirada:   { label: 'Expirada',   badge: 'badge-gray' },
}

export default function ClientePropostasPage() {
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/propostas?limit=50')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setPropostas(data.data)
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Propostas</h1>
      <p className="text-gray-500 mb-8">Veja as propostas enviadas pela Volve.</p>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Carregando…</p>
      ) : propostas.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-3xl mb-2">📄</p>
          <p className="text-gray-500">Nenhuma proposta recebida ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {propostas.map((p) => {
            const cfg = statusConfig[p.status]
            const isOpen = ['enviada', 'visualizada'].includes(p.status)

            return (
              <div
                key={p.id}
                className={`card ${isOpen ? 'border-l-4 border-l-volve-500' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{p.titulo}</h3>
                      <span className={cfg?.badge ?? 'badge-gray'}>{cfg?.label}</span>
                    </div>
                    {p.descricao && (
                      <p className="text-sm text-gray-500 mb-1">{p.descricao}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      Criada em{' '}
                      {formatDateInAppTimeZone(p.createdAt)}
                      {p.validade &&
                        ` · válida até ${formatDateInAppTimeZone(p.validade)}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-2xl font-bold text-volve-700">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(Number(p.valorTotal))}
                    </p>
                    <a
                      href={`/propostas/${p.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary text-xs py-1.5"
                    >
                      Ver proposta completa
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
