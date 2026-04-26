'use client'

import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/panel/empty-state'
import { ProposalIcon } from '@/components/panel/icons'
import { PageHeader } from '@/components/panel/page-header'
import { formatDateInAppTimeZone } from '@/lib/timezone'

interface Proposta {
  id: string
  titulo: string
  valorTotal: string
  status: string
  token: string
  createdAt: string
  aceitoEm: string | null
  cliente: { nome: string; email: string } | null
  lead: { name: string; email: string | null } | null
}

function getPropostaContato(proposta: Proposta) {
  return proposta.cliente?.nome ?? proposta.lead?.name ?? 'Contato nao identificado'
}

const statusBadge: Record<string, string> = {
  rascunho: 'badge-gray',
  enviada: 'badge-blue',
  visualizada: 'badge-yellow',
  aceita: 'badge-green',
  recusada: 'badge-red',
  expirada: 'badge-gray',
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

  useEffect(() => {
    fetchPropostas()
  }, [])

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
    alert('Link copiado para a area de transferencia.')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercial"
        title="Propostas"
        description="Mantenha a esteira comercial visivel, com acesso rapido ao link publico e com espaco para follow-up pelo novo modulo de comunicacao."
        meta={[{ label: `${propostas.length} proposta(s)` }]}
        actions={
          <>
            <a href="/painel/comunicacao" className="btn-secondary">
              Follow-ups
            </a>
            <a href="/painel/propostas/nova" className="btn-primary">
              Nova proposta
            </a>
          </>
        }
      />

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Carregando propostas...</div>
        ) : propostas.length === 0 ? (
          <EmptyState
            icon={<ProposalIcon className="h-6 w-6" />}
            title="Nenhuma proposta criada"
            description="Monte a primeira proposta para ativar a esteira comercial completa da plataforma."
            action={
              <a href="/painel/propostas/nova" className="btn-primary">
                Criar proposta
              </a>
            }
          />
        ) : (
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Titulo</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Criada</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((proposta) => (
                <tr key={proposta.id}>
                  <td className="font-medium">{getPropostaContato(proposta)}</td>
                  <td>{proposta.titulo}</td>
                  <td className="font-semibold text-slate-900">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(Number(proposta.valorTotal))}
                  </td>
                  <td>
                    <span className={statusBadge[proposta.status] ?? 'badge-gray'}>
                      {proposta.status}
                    </span>
                  </td>
                  <td className="text-slate-500">
                    {formatDateInAppTimeZone(proposta.createdAt)}
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => copyLink(proposta.token)}
                        className="text-xs font-semibold text-volve-700 hover:text-volve-800"
                      >
                        Copiar link
                      </button>
                      {proposta.status === 'rascunho' ? (
                        <button
                          type="button"
                          onClick={() => handleEnviar(proposta.id)}
                          disabled={sending === proposta.id}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                        >
                          {sending === proposta.id ? 'Enviando...' : 'Enviar WhatsApp'}
                        </button>
                      ) : null}
                      <a
                        href="/painel/comunicacao"
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                      >
                        Agendar follow-up
                      </a>
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
