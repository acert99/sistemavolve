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
  cliente: { nome: string; email: string }
}

const statusBadge: Record<string, string> = {
  pendente:  'badge-yellow',
  enviado:   'badge-blue',
  assinado:  'badge-green',
  cancelado: 'badge-gray',
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchContratos() {
    setLoading(true)
    const res = await fetch('/api/contratos?limit=50')
    const data = await res.json()
    if (data.success) setContratos(data.data)
    setLoading(false)
  }

  useEffect(() => { fetchContratos() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-sm text-gray-500">
            Geração e assinatura eletrônica via Autentique
          </p>
        </div>
        <a href="/painel/contratos/novo" className="btn-primary">
          + Novo contrato
        </a>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Carregando…</p>
        ) : contratos.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            Nenhum contrato criado ainda.
          </p>
        ) : (
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Título</th>
                <th>Status</th>
                <th>Assinado em</th>
                <th>Criado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.cliente.nome}</td>
                  <td>{c.titulo}</td>
                  <td>
                    <span className={statusBadge[c.status] ?? 'badge-gray'}>
                      {c.status}
                    </span>
                  </td>
                  <td className="text-gray-400">
                    {c.assinadoEm
                      ? new Intl.DateTimeFormat('pt-BR').format(new Date(c.assinadoEm))
                      : '—'}
                  </td>
                  <td className="text-gray-400">
                    {new Intl.DateTimeFormat('pt-BR').format(new Date(c.createdAt))}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {c.linkAssinatura && (
                        <a
                          href={c.linkAssinatura}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-volve-600 hover:underline"
                        >
                          Link assinatura
                        </a>
                      )}
                      {c.documentoUrl && (
                        <a
                          href={c.documentoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-green-600 hover:underline"
                        >
                          Baixar PDF
                        </a>
                      )}
                    </div>
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
