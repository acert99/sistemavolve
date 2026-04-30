'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ClienteOption = { id: string; nome: string }

export function NewReportForm({ clientes }: { clientes: ClienteOption[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function create(formData: FormData) {
    setError(null)
    const body = Object.fromEntries(formData.entries())
    const response = await fetch('/api/relatorios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok || !data.success) {
      setError(data.error || 'Falha ao criar relatório')
      return
    }
    router.push(`/painel/relatorios/${data.data.id}`)
  }

  const input = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-volve-400'
  const label = 'space-y-1 text-sm font-medium text-slate-700'

  return (
    <form action={create} className="max-w-3xl space-y-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <label className={label}>Cliente
        <select className={input} name="clientId" required>
          {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
        </select>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>Tipo
          <select className={input} name="type"><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select>
        </label>
        <label className={label}>Título
          <input className={input} name="title" placeholder="Relatório Mensal — Cliente" />
        </label>
        <label className={label}>Início do período<input className={input} type="date" name="periodStart" required /></label>
        <label className={label}>Fim do período<input className={input} type="date" name="periodEnd" required /></label>
      </div>
      <label className={label}>Resumo inicial<textarea className={input} name="summary" rows={4} placeholder="Resumo opcional do rascunho" /></label>
      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">Criar rascunho</button>
    </form>
  )
}
