'use client'

import { useEffect, useState } from 'react'
import type { Cliente } from '@/types'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    nome: '', email: '', whatsapp: '', cpfCnpj: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchClientes(q = '') {
    setLoading(true)
    const res = await fetch(`/api/clientes?q=${encodeURIComponent(q)}&limit=50`)
    const data = await res.json()
    if (data.success) {
      setClientes(data.data)
      setTotal(data.meta.total)
    }
    setLoading(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => fetchClientes(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (data.success) {
      setShowForm(false)
      setForm({ nome: '', email: '', whatsapp: '', cpfCnpj: '' })
      fetchClientes(search)
    } else {
      setError(data.error)
    }

    setSaving(false)
  }

  async function handleToggleAtivo(cliente: Cliente) {
    await fetch(`/api/clientes/${cliente.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !cliente.ativo }),
    })
    fetchClientes(search)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500">{total} clientes cadastrados</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Novo cliente
        </button>
      </div>

      {/* Busca */}
      <div className="card mb-6">
        <input
          type="search"
          placeholder="Buscar por nome, e-mail ou CPF/CNPJ…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-md"
        />
      </div>

      {/* Modal Novo Cliente */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Novo Cliente</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input
                  required
                  className="input"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div>
                <label className="label">E-mail *</label>
                <input
                  required
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">WhatsApp</label>
                  <input
                    className="input"
                    placeholder="55119999xxxxx"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">CPF / CNPJ</label>
                  <input
                    className="input"
                    value={form.cpfCnpj}
                    onChange={(e) => setForm({ ...form, cpfCnpj: e.target.value })}
                  />
                </div>
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Salvando…' : 'Salvar'}
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
        ) : clientes.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            Nenhum cliente encontrado.
          </p>
        ) : (
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>WhatsApp</th>
                <th>CPF/CNPJ</th>
                <th>Status</th>
                <th>Cadastro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.nome}</td>
                  <td>{c.email}</td>
                  <td>{c.whatsapp ?? '—'}</td>
                  <td>{c.cpfCnpj ?? '—'}</td>
                  <td>
                    <span className={c.ativo ? 'badge-green' : 'badge-gray'}>
                      {c.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="text-gray-400">
                    {new Intl.DateTimeFormat('pt-BR').format(new Date(c.createdAt))}
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleAtivo(c)}
                      className="text-xs text-gray-400 hover:text-gray-700"
                    >
                      {c.ativo ? 'Desativar' : 'Ativar'}
                    </button>
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
