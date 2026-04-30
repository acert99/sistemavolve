'use client'

import { useEffect, useMemo, useState } from 'react'

type ClientOption = { id: string; nome: string }

type Idea = {
  id: string
  clientId: string
  clientSlug: string
  monthRef: string
  dayRef: string
  batchId: string | null
  source: 'clickup' | 'generated' | 'manual'
  status: 'pending' | 'approved' | 'rejected'
  clickupTaskId: string | null
  theme: string | null
  hook: string | null
  format: string | null
  cta: string | null
  notes: string | null
}

function todayMonthRef() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export default function IdeasClient({ clients }: { clients: ClientOption[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [monthRef, setMonthRef] = useState(todayMonthRef())
  const [mode, setMode] = useState<'replace_pending' | 'new_batch'>('replace_pending')
  const [loading, setLoading] = useState(false)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [error, setError] = useState<string | null>(null)

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  )

  async function loadIdeas() {
    if (!clientId || !monthRef) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendario-conteudo/ideias?clientId=${encodeURIComponent(clientId)}&month=${encodeURIComponent(monthRef)}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Falha ao carregar')
      setIdeas(json.data as Idea[])
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  async function generateIdeas() {
    if (!clientId || !monthRef) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/calendario-conteudo/ideias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, month: monthRef, mode }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Falha ao gerar')
      await loadIdeas()
    } catch (e: any) {
      setError(e?.message || 'Erro ao gerar')
    } finally {
      setLoading(false)
    }
  }

  async function patchIdea(id: string, patch: Partial<Idea>) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendario-conteudo/ideias/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Falha ao atualizar')
      setIdeas((prev) => prev.map((i) => (i.id === id ? (json.data as Idea) : i)))
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadIdeas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, monthRef])

  return (
    <section className="panel-card space-y-4 p-6">
      <div className="grid gap-3 md:grid-cols-[1fr,180px,220px]">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600">Cliente</span>
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600">Mês (YYYY-MM)</span>
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={monthRef}
            onChange={(e) => setMonthRef(e.target.value)}
            placeholder="2026-05"
          />
        </label>

        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-600">Geração</span>
          <div className="flex gap-2">
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
            >
              <option value="replace_pending">Regerar (substitui pendentes)</option>
              <option value="new_batch">Nova rodada (batch)</option>
            </select>
            <button
              onClick={() => void generateIdeas()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              disabled={loading}
            >
              Gerar
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-700">
          {selectedClient ? <span className="font-semibold">{selectedClient.nome}</span> : null} · {monthRef}
        </div>
        <button
          onClick={() => void loadIdeas()}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          disabled={loading}
        >
          Atualizar
        </button>
      </div>

      <div className="overflow-auto rounded-2xl border border-slate-200">
        <table className="min-w-[980px] w-full border-collapse bg-white text-left text-sm">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Fonte</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Tema</th>
              <th className="px-3 py-2">Gancho</th>
              <th className="px-3 py-2">Formato</th>
              <th className="px-3 py-2">CTA</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {ideas.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={8}>
                  Nenhuma ideia ainda. Clique em <b>Gerar</b>.
                </td>
              </tr>
            ) : (
              ideas.map((idea) => (
                <tr key={idea.id} className="border-t border-slate-200 align-top">
                  <td className="px-3 py-2 font-semibold text-slate-800">{idea.dayRef.slice(0, 10)}</td>
                  <td className="px-3 py-2 text-slate-600">{idea.source}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        idea.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : idea.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {idea.status}
                    </span>
                  </td>
                  {(['theme', 'hook', 'format', 'cta'] as const).map((field) => (
                    <td key={field} className="px-3 py-2">
                      <textarea
                        className="min-h-[56px] w-full resize-y rounded-xl border border-slate-200 px-2 py-1 text-sm"
                        value={(idea[field] ?? '') as string}
                        onChange={(e) => setIdeas((prev) => prev.map((p) => (p.id === idea.id ? { ...p, [field]: e.target.value } : p)))}
                        onBlur={(e) => void patchIdea(idea.id, { [field]: e.target.value } as any)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-2">
                      <button
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                        onClick={() => void patchIdea(idea.id, { status: 'approved' } as any)}
                        disabled={loading}
                      >
                        Aprovar
                      </button>
                      <button
                        className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                        onClick={() => void patchIdea(idea.id, { status: 'rejected' } as any)}
                        disabled={loading}
                      >
                        Rejeitar
                      </button>
                      <button
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => void patchIdea(idea.id, { status: 'pending' } as any)}
                        disabled={loading}
                      >
                        Voltar p/ pendente
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

