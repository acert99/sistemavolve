'use client'

import { useEffect, useState } from 'react'

export function ClickUpEmbed({ viewUrl }: { viewUrl: string | null }) {
  const [embedFailed, setEmbedFailed] = useState(false)

  useEffect(() => {
    setEmbedFailed(false)
  }, [viewUrl])

  if (!viewUrl) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm leading-6 text-slate-600">
        A view publica do ClickUp ainda nao foi configurada para esta carteira. Adicione a URL da view em
        {' '}
        <code>CLICKUP_PUBLIC_VIEW_URL_VOLVE</code>
        {' '}
        ou
        {' '}
        <code>CLICKUP_PUBLIC_VIEW_URL_VOLVE_HEALTH</code>
        {' '}
        para liberar a aba de quadro no app.
      </div>
    )
  }

  if (embedFailed) {
    return (
      <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm font-semibold text-amber-900">
          O ClickUp nao conseguiu carregar dentro do painel.
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-900/90">
          Safari, Firefox e ambientes com cookies de terceiros bloqueados costumam derrubar o embed. Use a abertura externa como fallback seguro.
        </p>
        <a
          href={viewUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary mt-4"
        >
          Abrir no ClickUp
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        <p>Quadro publico do ClickUp carregado como apoio visual. A fila continua sendo a camada principal de operacao.</p>
        <a href={viewUrl} target="_blank" rel="noreferrer" className="btn-secondary shrink-0">
          Abrir externo
        </a>
      </div>

      <iframe
        src={viewUrl}
        title="Quadro ClickUp"
        loading="lazy"
        onError={() => setEmbedFailed(true)}
        className="h-[780px] w-full rounded-[28px] border border-slate-200 bg-white"
      />
    </div>
  )
}
