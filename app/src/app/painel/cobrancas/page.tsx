'use client'

import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/panel/empty-state'
import { BillingIcon } from '@/components/panel/icons'
import { PageHeader } from '@/components/panel/page-header'
import { formatDateInAppTimeZone } from '@/lib/timezone'

interface Cobranca {
  id: string
  descricao: string
  valor: string
  vencimento: string
  status: string
  tipo: string
  linkPagamento: string | null
  pagoEm: string | null
  createdAt: string
  cliente: { nome: string; email: string }
}

const statusBadge: Record<string, string> = {
  PENDING: 'badge-yellow',
  RECEIVED: 'badge-green',
  CONFIRMED: 'badge-green',
  OVERDUE: 'badge-red',
  REFUNDED: 'badge-gray',
  RECEIVED_IN_CASH: 'badge-green',
}

const statusLabel: Record<string, string> = {
  PENDING: 'Pendente',
  RECEIVED: 'Pago',
  CONFIRMED: 'Confirmado',
  OVERDUE: 'Vencido',
  REFUNDED: 'Estornado',
  RECEIVED_IN_CASH: 'Pago em dinheiro',
}

export default function CobrancasPage() {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([])
  const [meta, setMeta] = useState({ total: 0, vencidas: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([])
  const [form, setForm] = useState({
    clienteId: '',
    descricao: '',
    valor: '',
    vencimento: '',
    tipo: 'UNDEFINED',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchCobrancas(status = '') {
    setLoading(true)
    const params = new URLSearchParams({ limit: '50' })
    if (status) params.set('status', status)
    const res = await fetch(`/api/cobrancas?${params}`)
    const data = await res.json()
    if (data.success) {
      setCobrancas(data.data)
      setMeta({ total: data.meta.total, vencidas: data.meta.vencidas })
    }
    setLoading(false)
  }

  async function fetchClientes() {
    const res = await fetch('/api/clientes?limit=100&ativo=true')
    const data = await res.json()
    if (data.success) setClientes(data.data)
  }

  useEffect(() => {
    fetchCobrancas(statusFilter)
  }, [statusFilter])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const res = await fetch('/api/cobrancas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, valor: Number(form.valor) }),
    })
    const data = await res.json()

    if (data.success) {
      setShowForm(false)
      setForm({ clienteId: '', descricao: '', valor: '', vencimento: '', tipo: 'UNDEFINED' })
      fetchCobrancas(statusFilter)
    } else {
      setError(data.error)
    }

    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Cobrancas"
        description="Visualize pendencias, gere novas cobrancas e use Comunicacao para reforcos antes que a inadimplencia cresca."
        meta={[
          { label: `${meta.total} cobranca(s)` },
          {
            label: `${meta.vencidas} vencida(s)`,
            tone: meta.vencidas > 0 ? 'danger' : 'default',
          },
        ]}
        actions={
          <>
            <a href="/painel/comunicacao" className="btn-secondary">
              Lembretes
            </a>
            <button
              type="button"
              onClick={() => {
                setShowForm(true)
                fetchClientes()
              }}
              className="btn-primary"
            >
              Nova cobranca
            </button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[
          { value: '', label: 'Todas' },
          { value: 'PENDING', label: 'Pendentes' },
          { value: 'OVERDUE', label: 'Vencidas' },
          { value: 'RECEIVED', label: 'Pagas' },
        ].map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={statusFilter === filter.value ? 'btn-primary' : 'btn-secondary'}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-[32px] border border-white/70 bg-white p-6 shadow-2xl">
            <div className="mb-4 space-y-2">
              <p className="panel-kicker">Financeiro</p>
              <h2 className="text-2xl font-semibold text-slate-950">Nova cobranca</h2>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Cliente</label>
                <select
                  required
                  className="input"
                  value={form.clienteId}
                  onChange={(event) => setForm({ ...form, clienteId: event.target.value })}
                >
                  <option value="">Selecione...</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Descricao</label>
                <input
                  required
                  className="input"
                  value={form.descricao}
                  onChange={(event) => setForm({ ...form, descricao: event.target.value })}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Valor</label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="input"
                    value={form.valor}
                    onChange={(event) => setForm({ ...form, valor: event.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Vencimento</label>
                  <input
                    required
                    type="date"
                    className="input"
                    value={form.vencimento}
                    onChange={(event) => setForm({ ...form, vencimento: event.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Tipo de pagamento</label>
                <select
                  className="input"
                  value={form.tipo}
                  onChange={(event) => setForm({ ...form, tipo: event.target.value })}
                >
                  <option value="UNDEFINED">Cliente escolhe</option>
                  <option value="PIX">PIX</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="CREDIT_CARD">Cartao de credito</option>
                </select>
              </div>

              {error ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setError(null)
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Criando...' : 'Criar cobranca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Carregando cobrancas...</div>
        ) : cobrancas.length === 0 ? (
          <EmptyState
            icon={<BillingIcon className="h-6 w-6" />}
            title="Nenhuma cobranca encontrada"
            description="Crie uma cobranca para comecar a acompanhar pagamentos e disparar lembretes pelo modulo de comunicacao."
            action={
              <button
                type="button"
                onClick={() => {
                  setShowForm(true)
                  fetchClientes()
                }}
                className="btn-primary"
              >
                Criar cobranca
              </button>
            }
          />
        ) : (
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Descricao</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {cobrancas.map((cobranca) => (
                <tr key={cobranca.id}>
                  <td className="font-medium">{cobranca.cliente.nome}</td>
                  <td>{cobranca.descricao}</td>
                  <td className="font-semibold text-slate-900">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(Number(cobranca.valor))}
                  </td>
                  <td className="text-slate-500">
                    {formatDateInAppTimeZone(cobranca.vencimento)}
                  </td>
                  <td className="text-xs text-slate-500">{cobranca.tipo}</td>
                  <td>
                    <span className={statusBadge[cobranca.status] ?? 'badge-gray'}>
                      {statusLabel[cobranca.status] ?? cobranca.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-3">
                      {cobranca.linkPagamento ? (
                        <a
                          href={cobranca.linkPagamento}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-volve-700 hover:text-volve-800"
                        >
                          Ver fatura
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
