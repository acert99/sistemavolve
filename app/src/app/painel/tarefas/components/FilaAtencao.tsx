'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { refreshClickUpTasksAction } from '@/app/painel/tarefas/actions'
import { ClickUpEmbed } from '@/app/painel/tarefas/components/ClickUpEmbed'
import { FiltroCarteira } from '@/app/painel/tarefas/components/FiltroCarteira'
import { GrupoTarefas } from '@/app/painel/tarefas/components/GrupoTarefas'
import type {
  ClientListOption,
  PortfolioKey,
  PortfolioOption,
  TaskGroupView,
} from '@/app/painel/tarefas/types'
import { EmptyState } from '@/components/panel/empty-state'
import { TasksIcon } from '@/components/panel/icons'

interface FilaAtencaoProps {
  groups: TaskGroupView[]
  portfolioOptions: PortfolioOption[]
  clientOptions: ClientListOption[]
  selectedPortfolio: PortfolioKey
  selectedClientId: string | null
  isFriday: boolean
  updatedAtLabel: string
  embedViews: Array<{
    key: Exclude<PortfolioKey, 'all'>
    label: string
    url: string | null
  }>
  warnings: string[]
}

type ActiveTab = 'fila' | 'quadro'

export function FilaAtencao({
  groups,
  portfolioOptions,
  clientOptions,
  selectedPortfolio,
  selectedClientId,
  isFriday,
  updatedAtLabel,
  embedViews,
  warnings,
}: FilaAtencaoProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ActiveTab>('fila')
  const [isRefreshing, startRefreshTransition] = useTransition()
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const hasTasks = useMemo(() => groups.some((group) => group.items.length > 0), [groups])

  function handleRefresh() {
    setRefreshError(null)

    startRefreshTransition(async () => {
      const result = await refreshClickUpTasksAction()

      if (!result.success) {
        setRefreshError(result.error)
        return
      }

      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <h2 className="section-title">Fila de atencao</h2>
            <p className="section-copy">
              A pagina responde ao que precisa de acao agora, com dados em tempo real do ClickUp e classificacao feita no servidor.
            </p>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Ultima leitura:
              {' '}
              {updatedAtLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('fila')}
              className={activeTab === 'fila' ? 'btn-primary' : 'btn-secondary'}
            >
              Fila
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('quadro')}
              className={activeTab === 'quadro' ? 'btn-primary' : 'btn-secondary'}
            >
              Quadro
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-secondary"
            >
              {isRefreshing ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>
        </div>

        <FiltroCarteira
          portfolioOptions={portfolioOptions}
          clientOptions={clientOptions}
          selectedPortfolio={selectedPortfolio}
          selectedClientId={selectedClientId}
        />

        {isFriday ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Hoje e sexta — organize o que comeca na segunda antes da fila virar improviso.
          </div>
        ) : null}

        {warnings.map((warning) => (
          <div
            key={warning}
            className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
          >
            {warning}
          </div>
        ))}

        {refreshError ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {refreshError}
          </div>
        ) : null}
      </section>

      {activeTab === 'fila' ? (
        hasTasks ? (
          <div className="space-y-4">
            {groups.map((group) => (
              <GrupoTarefas key={group.id} group={group} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<TasksIcon className="h-6 w-6" />}
            title="Nenhuma task ativa encontrada"
            description="A fila nao encontrou tarefas ativas no ClickUp para os filtros atuais. Revise a carteira, o cliente selecionado ou os statuses ativos da view."
          />
        )
      ) : (
        <section className="card space-y-5">
          <div className="space-y-2">
            <h2 className="section-title">Quadro complementar</h2>
            <p className="section-copy">
              O embed entra como apoio visual. Quando ele falha por cookies, a operacao continua segura pela fila e pela abertura externa.
            </p>
          </div>

          <div className="space-y-6">
            {embedViews.map((view) => (
              <div key={view.key} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{view.label}</p>
                    <p className="text-sm text-slate-500">
                      Quadro publico da vertical carregado como apoio visual.
                    </p>
                  </div>
                </div>

                <ClickUpEmbed viewUrl={view.url} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
