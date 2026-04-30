'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Action = 'reviewed' | 'approved' | 'sent' | 'import-clickup' | 'consolidate' | 'markdown' | 'pdf'

export function ReportActions({ reportId, type, status }: { reportId: string; type: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function run(action: Action) {
    setLoading(action)
    setMessage(null)
    try {
      let url = `/api/relatorios/${reportId}`
      let init: RequestInit = { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: action }) }
      if (action === 'import-clickup') {
        url = `/api/relatorios/${reportId}/import-clickup`
        init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
      }
      if (action === 'consolidate') {
        url = `/api/relatorios/${reportId}/consolidar-mensal`
        init = { method: 'POST' }
      }
      if (action === 'markdown') {
        url = `/api/relatorios/${reportId}/assets`
        init = { method: 'POST' }
      }
      if (action === 'pdf') {
        url = `/api/relatorios/${reportId}/pdf`
        init = { method: 'POST' }
      }
      const response = await fetch(url, init)
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Falha na acao')
      setMessage('Ação concluída com segurança. Nenhum dado externo foi alterado.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao executar ação')
    } finally {
      setLoading(null)
    }
  }

  const button = 'rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50'

  return (
    <div className="space-y-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">Ações do relatório</p>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={loading !== null} onClick={() => run('import-clickup')}>Importar ClickUp</button>
        {type === 'monthly' ? <button className={button} disabled={loading !== null} onClick={() => run('consolidate')}>Consolidar mês</button> : null}
        <button className={button} disabled={loading !== null} onClick={() => run('markdown')}>Salvar Markdown</button>
        <button className={button} disabled={loading !== null} onClick={() => run('pdf')}>Gerar PDF</button>
        {status === 'draft' ? <button className={button} disabled={loading !== null} onClick={() => run('reviewed')}>Marcar revisado</button> : null}
        {status === 'reviewed' ? <button className={button} disabled={loading !== null} onClick={() => run('approved')}>Aprovar</button> : null}
        {status === 'approved' ? <button className={button} disabled={loading !== null} onClick={() => run('sent')}>Marcar enviado</button> : null}
      </div>
      {loading ? <p className="text-xs text-slate-500">Processando ação...</p> : null}
      {message ? <p className="text-xs text-slate-600">{message}</p> : null}
    </div>
  )
}
