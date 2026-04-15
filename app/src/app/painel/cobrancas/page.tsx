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
  pagoEm: string | null
  createdAt: string
  cliente: { nome: string; email: string }
}

const statusBadge: Record<string, string> = {
  PENDING:                      'badge-yellow',
  RECEIVED:                     'badge-green',
  CONFIRMED:                    'badge-green',
  OVERDUE:                      'badge-red',
  REFUNDED:                     'badge-gray',
  RECEIVED_IN_CASH:             'badge-green',
}

const statusLabel: Record<string, string> = {
  PENDING:          'Pendente',
  RECEIVED:         'Pago',
  CONFIRMED:        'Confirmado',
  OVERDUE:          'Vencido',
  REFUNDED:         'Estornado',
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cobranças</h1>
          <p className="text-sm text-gray-500">
            {meta.total} cobranças ·{' '}
            <span className={meta.vencidas > 0 ? 'text-red-600 font-medium' : ''}>
              {meta.vencidas} vencidas
            </span>
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); fetchClientes() }}
          className="btn-primary"
        >
          + Nova cobrança
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { value: '', label: 'Todas' },
          { value: 'PENDING', label: 'Pendentes' },
          { value: 'OVERDUE', label: 'Vencidas' },
          { value: 'RECEIVED', label: 'Pagas' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-volve-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Modal Nova Cobrança */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Nova Cobrança</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Cliente *</label>
                <select
                  required
                  className="input"
                  value={form.clienteId}
                  onChange={(e) => setForm({ ...form, clienteId: e.target.value })}
                >
                  <option value="">Selecione…</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Descrição *</label>
                <input
                  required
                  className="input"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Valor (R$) *</label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="input"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Vencimento *</label>
                  <input
                    required
                    type="date"
                    className="input"
                    value={form.vencimento}
                    onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Tipo de pagamento</label>
                <select
                  className="input"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                >
                  <option value="UNDEFINED">Cliente escolhe</option>
                  <option value="PIX">PIX</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="CREDIT_CARD">Cartão de crédito</option>
                </select>
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Criando…' : 'Criar e notificar'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(null) }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Carregando…</p>
        ) : cobrancas.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            Nenhuma cobrança encontrada.
          </p>
        ) : (
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cobrancas.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.cliente.nome}</td>
                  <td>{c.descricao}</td>
                  <td className="font-semibold">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(Number(c.valor))}
                  </td>
                  <td className="text-gray-400">
                    {new Intl.DateTimeFormat('pt-BR').format(new Date(c.vencimento))}
                  </td>
                  <td className="text-gray-400 text-xs">{c.tipo}</td>
                  <td>
                    <span className={statusBadge[c.status] ?? 'badge-gray'}>
                      {statusLabel[c.status] ?? c.status}
                    </span>
                  </td>
                  <td>
                    {c.linkPagamento && (
                      <a
                        href={c.linkPagamento}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-volve-600 hover:underline"
                      >
                        Ver fatura
                      </a>
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
