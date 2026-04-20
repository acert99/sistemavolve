'use client'

import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/panel/empty-state'
import { PageHeader } from '@/components/panel/page-header'
import { ServiceIcon } from '@/components/panel/icons'

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

  useEffect(() => {
    fetchServicos()
  }, [])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogo"
        title="Servicos"
        description="Padronize a oferta da agencia e alimente propostas e tarefas com um catalogo mais coerente."
        meta={[{ label: `${servicos.length} servico(s)` }]}
        actions={
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
            Novo servico
          </button>
        }
      />

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-[32px] border border-white/70 bg-white p-6 shadow-2xl">
            <div className="mb-4 space-y-2">
              <p className="panel-kicker">Catalogo</p>
              <h2 className="text-2xl font-semibold text-slate-950">Novo servico</h2>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Nome</label>
                <input
                  required
                  className="input"
                  value={form.nome}
                  onChange={(event) => setForm({ ...form, nome: event.target.value })}
                />
              </div>
              <div>
                <label className="label">Descricao</label>
                <textarea
                  rows={3}
                  className="input resize-none"
                  value={form.descricao}
                  onChange={(event) => setForm({ ...form, descricao: event.target.value })}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Preco</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={form.preco}
                    onChange={(event) => setForm({ ...form, preco: event.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Categoria</label>
                  <input
                    className="input"
                    value={form.categoria}
                    onChange={(event) => setForm({ ...form, categoria: event.target.value })}
                  />
                </div>
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
                  {saving ? 'Salvando...' : 'Salvar servico'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="card py-10 text-center text-sm text-slate-500">Carregando servicos...</div>
      ) : servicos.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ServiceIcon className="h-6 w-6" />}
            title="Nenhum servico cadastrado"
            description="Monte o catalogo para melhorar propostas, alinhar escopo e preparar o novo modulo de tarefas."
            action={
              <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
                Criar servico
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {servicos.map((servico) => (
            <article
              key={servico.id}
              className="card transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  {servico.categoria ? (
                    <span className="badge-purple mb-2 inline-flex">{servico.categoria}</span>
                  ) : null}
                  <h2 className="text-lg font-semibold text-slate-950">{servico.nome}</h2>
                </div>
                <span className={servico.ativo ? 'badge-green' : 'badge-gray'}>
                  {servico.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-500">
                {servico.descricao ?? 'Servico pronto para compor propostas e organizar a operacao.'}
              </p>
              <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(Number(servico.preco))}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
