'use client'

import { useEffect, useState } from 'react'

interface Proposta {
  id: string
  titulo: string
  valorTotal: string
  status: string
  token: string
  createdAt: string
  aceitoEm: string | null
  cliente: { nome: string; email: string }
}

const statusBadge: Record<string, string> = {
  rascunho:   'badge-gray',
  enviada:    'badge-blue',
  visualizada:'badge-yellow',
  aceita:     'badge-green',
  recusada:   'badge-red',
  expirada:   'badge-gray',
}

export default function PropostasPage() {
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)

  async function fetchPropostas() {
    setLoading(true)
    const res = await fetch('/api/propostas?limit=50')
    const data = await res.json()
    if (data.success) setPropostas(data.data)
    setLoading(false)
  }

  useEffect(() => { fetchPropostas() }, [])

  async function handleEnviar(id: string) {
    setSending(id)
    await fetch(`/api/propostas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enviar' }),
    })
    setSending(null)
    fetchPropostas()
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/propostas/${token}`
    navigator.clipboard.writeText(url)
    alert('Link copiado para a área de transferência!')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Propostas</h1>
          <p className="text-sm text-gray-500">
            Geração de propostas com PDF e link único
          </p>
        </div>
        <a href="/painel/propostas/nova" className="btn-primary">
          + Nova proposta
        </a>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Carregando…</p>
        ) : propostas.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            Nenhuma proposta criada ainda.
          </p>
        ) : (
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Título</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Criada</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.cliente.nome}</td>
                  <td>{p.titulo}</td>
                  <td className="font-semibold text-volve-700">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(Number(p.valorTotal))}
                  </td>
                  <td>
                    <span className={statusBadge[p.status] ?? 'badge-gray'}>
                      {p.status}
                    </span>
                  </td>
                  <td className="text-gray-400">
                    {new Intl.DateTimeFormat('pt-BR').format(new Date(p.createdAt))}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyLink(p.token)}
                        className="text-xs text-volve-600 hover:underline"
                      >
                        Copiar link
                      </button>
                      {(p.status === 'rascunho') && (
                        <button
                          onClick={() => handleEnviar(p.id)}
                          disabled={sending === p.id}
                          className="text-xs text-green-600 hover:underline disabled:opacity-50"
                        >
                          {sending === p.id ? 'Enviando…' : 'Enviar WhatsApp'}
                        </button>
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
