'use client'

import { useEffect, useState } from 'react'

interface Contrato {
  id: string
  titulo: string
  status: string
  linkAssinatura: string | null
  documentoUrl: string | null
  assinadoEm: string | null
  createdAt: string
}

const statusConfig: Record<string, { label: string; badge: string }> = {
  pendente:  { label: 'Pendente',  badge: 'badge-yellow' },
  enviado:   { label: 'Aguardando assinatura', badge: 'badge-blue' },
  assinado:  { label: 'Assinado', badge: 'badge-green' },
  cancelado: { label: 'Cancelado', badge: 'badge-gray' },
}

export default function ClienteContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/contratos?limit=50')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setContratos(data.data)
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Contratos</h1>
      <p className="text-gray-500 mb-8">
        Assine e acompanhe seus contratos digitalmente.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Carregando…</p>
      ) : contratos.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-3xl mb-2">📝</p>
          <p className="text-gray-500">Nenhum contrato emitido ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contratos.map((c) => {
            const cfg = statusConfig[c.status]
            const precisaAssinar = c.status === 'enviado' && !!c.linkAssinatura

            return (
              <div
                key={c.id}
                className={`card ${precisaAssinar ? 'border-l-4 border-l-amber-400' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{c.titulo}</h3>
                      <span className={cfg?.badge ?? 'badge-gray'}>
                        {cfg?.label ?? c.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Emitido em{' '}
                      {new Intl.DateTimeFormat('pt-BR').format(new Date(c.createdAt))}
                      {c.assinadoEm &&
                        ` · Assinado em ${new Intl.DateTimeFormat('pt-BR').format(new Date(c.assinadoEm))}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {precisaAssinar && (
                      <a
                        href={c.linkAssinatura!}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary"
                      >
                        ✍️ Assinar agora
                      </a>
                    )}
                    {c.documentoUrl && (
                      <a
                        href={c.documentoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary text-sm"
                      >
                        ⬇️ Baixar PDF
                      </a>
                    )}
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
