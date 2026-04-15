'use client'

import { useEffect, useState } from 'react'

interface Servico {
  id: string
  nome: string
  descricao: string | null
  preco: string
  categoria: string | null
  ativo: boolean
}

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', descricao: '', preco: '', categoria: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchServicos() {
    setLoading(true)
    const res = await fetch('/api/servicos?ativo=')
    const data = await res.json()
    if (data.success) setServicos(data.data)
    setLoading(false)
  }

  useEffect(() => { fetchServicos() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const res = await fetch('/api/servicos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, preco: Number(form.preco) }),
    })
    const data = await res.json()

    if (data.success) {
      setShowForm(false)
      setForm({ nome: '', descricao: '', preco: '', categoria: '' })
      fetchServicos()
    } else {
      setError(data.error)
    }

    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de Serviços</h1>
          <p className="text-sm text-gray-500">Serviços disponíveis para proposta</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Novo serviço
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Novo Serviço</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input required className="input" value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea rows={3} className="input resize-none" value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Preço (R$) *</label>
                  <input required type="number" min="0" step="0.01" className="input"
                    value={form.preco}
                    onChange={(e) => setForm({ ...form, preco: e.target.value })} />
                </div>
                <div>
                  <label className="label">Categoria</label>
                  <input className="input" placeholder="Ex: Design, Tráfego…"
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
                </div>
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setError(null) }}
                  className="btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid de serviços */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Carregando…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {servicos.map((s) => (
            <div key={s.id} className="card hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  {s.categoria && (
                    <span className="badge-purple mb-1 inline-block">{s.categoria}</span>
                  )}
                  <h3 className="font-semibold text-gray-900">{s.nome}</h3>
                </div>
                <span className={s.ativo ? 'badge-green' : 'badge-gray'}>
                  {s.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              {s.descricao && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{s.descricao}</p>
              )}
              <p className="text-xl font-bold text-volve-700">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(s.preco))}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
