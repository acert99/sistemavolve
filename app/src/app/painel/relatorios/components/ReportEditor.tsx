'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const itemTypes = [
  ['published_content', 'Conteúdo publicado'],
  ['pending_client', 'Pendência do cliente'],
  ['in_progress', 'Em andamento'],
  ['highlight', 'Destaque'],
  ['risk', 'Risco'],
  ['next_action', 'Próxima ação'],
  ['delayed', 'Atraso'],
  ['strategic_note', 'Nota estratégica'],
]

const metricOptions = [
  ['followers_start', 'Seguidores no início', 'seguidores'],
  ['followers_end', 'Seguidores no fim', 'seguidores'],
  ['followers_growth_absolute', 'Crescimento de seguidores', 'seguidores'],
  ['followers_growth_percent', 'Crescimento percentual', '%'],
  ['promised_posts', 'Posts prometidos', 'posts'],
  ['published_posts', 'Posts publicados', 'posts'],
  ['reach', 'Alcance', ''],
  ['impressions', 'Impressões', ''],
  ['engagement', 'Engajamento', ''],
  ['profile_visits', 'Visitas ao perfil', ''],
  ['link_clicks', 'Cliques no link', ''],
]

export function ReportEditor({ report }: { report: any }) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)

  async function submit(path: string, formData: FormData) {
    setMessage(null)
    const body = Object.fromEntries(formData.entries())
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok || !data.success) {
      setMessage(data.error || 'Falha ao salvar')
      return
    }
    setMessage('Salvo como rascunho.')
    router.refresh()
  }

  async function saveText(formData: FormData) {
    setMessage(null)
    const body = Object.fromEntries(formData.entries())
    const response = await fetch(`/api/relatorios/${report.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok || !data.success) {
      setMessage(data.error || 'Falha ao salvar')
      return
    }
    setMessage('Texto atualizado.')
    router.refresh()
  }

  const input = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-volve-400'
  const label = 'space-y-1 text-sm font-medium text-slate-700'
  const button = 'rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800'

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <form action={saveText} className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Texto do relatório</p>
        <label className={label}>Título<input className={input} name="title" defaultValue={report.title} /></label>
        <label className={label}>Resumo executivo<textarea className={input} name="summary" rows={4} defaultValue={report.summary ?? ''} /></label>
        <label className={label}>Destaques<textarea className={input} name="highlights" rows={3} defaultValue={report.highlights ?? ''} /></label>
        <label className={label}>Riscos<textarea className={input} name="risks" rows={3} defaultValue={report.risks ?? ''} /></label>
        <label className={label}>Próximos passos<textarea className={input} name="nextSteps" rows={3} defaultValue={report.nextSteps ?? ''} /></label>
        <button className={button}>Salvar texto</button>
      </form>

      <div className="space-y-6">
        <form action={(formData) => submit(`/api/relatorios/${report.id}/metrics`, formData)} className="space-y-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Adicionar métrica</p>
          <select className={input} name="metricKey" onChange={(event) => {
            const selected = metricOptions.find(([key]) => key === event.currentTarget.value)
            const form = event.currentTarget.form
            if (form && selected) {
              ;(form.elements.namedItem('label') as HTMLInputElement).value = selected[1]
              ;(form.elements.namedItem('unit') as HTMLInputElement).value = selected[2]
            }
          }}>
            {metricOptions.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
          </select>
          <input className={input} name="label" defaultValue={metricOptions[0][1]} placeholder="Rótulo" />
          <input className={input} name="value" type="number" step="0.01" placeholder="Valor" />
          <input className={input} name="unit" defaultValue={metricOptions[0][2]} placeholder="Unidade" />
          <input type="hidden" name="source" value="manual" />
          <button className={button}>Salvar métrica</button>
        </form>

        <form action={(formData) => submit(`/api/relatorios/${report.id}/items`, formData)} className="space-y-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Adicionar item narrativo</p>
          <select className={input} name="type">{itemTypes.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>
          <input className={input} name="title" placeholder="Título" required />
          <textarea className={input} name="description" rows={3} placeholder="Descrição" />
          <input className={input} name="contentUrl" placeholder="Link do conteúdo, se houver" />
          <button className={button}>Salvar item</button>
        </form>
        {message ? <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">{message}</p> : null}
      </div>
    </div>
  )
}
