'use client'

import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/panel/empty-state'
import { ContractIcon } from '@/components/panel/icons'
import { PageHeader } from '@/components/panel/page-header'
import { formatDateInAppTimeZone } from '@/lib/timezone'

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
  pendente: 'badge-yellow',
  enviado: 'badge-blue',
  assinado: 'badge-green',
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

  useEffect(() => {
    fetchContratos()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assinaturas"
        title="Contratos"
        description="Acompanhe a esteira de assinatura sem sair do painel e crie espaco para lembretes de assinatura pelo modulo de comunicacao."
        meta={[{ label: `${contratos.length} contrato(s)` }]}
        actions={
          <>
            <a href="/painel/comunicacao" className="btn-secondary">
              Lembretes
            </a>
            <a href="/painel/contratos/novo" className="btn-primary">
              Novo contrato
            </a>
          </>
        }
      />

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Carregando contratos...</div>
        ) : contratos.length === 0 ? (
          <EmptyState
            icon={<ContractIcon className="h-6 w-6" />}
            title="Nenhum contrato criado"
            description="Assim que o comercial fechar uma proposta, o modulo de contratos assume a etapa de assinatura com mais clareza."
            action={
              <a href="/painel/contratos/novo" className="btn-primary">
                Criar contrato
              </a>
            }
          />
        ) : (
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Titulo</th>
                <th>Status</th>
                <th>Assinado em</th>
                <th>Criado</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((contrato) => (
                <tr key={contrato.id}>
                  <td className="font-medium">{contrato.cliente.nome}</td>
                  <td>{contrato.titulo}</td>
                  <td>
                    <span className={statusBadge[contrato.status] ?? 'badge-gray'}>
                      {contrato.status}
                    </span>
                  </td>
                  <td className="text-slate-500">
                    {contrato.assinadoEm
                      ? formatDateInAppTimeZone(contrato.assinadoEm)
                      : '-'}
                  </td>
                  <td className="text-slate-500">
                    {formatDateInAppTimeZone(contrato.createdAt)}
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-3">
                      {contrato.linkAssinatura ? (
                        <a
                          href={contrato.linkAssinatura}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-volve-700 hover:text-volve-800"
                        >
                          Link assinatura
                        </a>
                      ) : null}
                      {contrato.documentoUrl ? (
                        <a
                          href={contrato.documentoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          Baixar PDF
                        </a>
                      ) : null}
                      <a
                        href="/painel/comunicacao"
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                      >
                        Agendar lembrete
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
