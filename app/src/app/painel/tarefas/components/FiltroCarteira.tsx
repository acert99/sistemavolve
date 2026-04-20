'use client'

import { startTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ClientListOption, PortfolioKey, PortfolioOption } from '@/app/painel/tarefas/types'

interface FiltroCarteiraProps {
  portfolioOptions: PortfolioOption[]
  clientOptions: ClientListOption[]
  selectedPortfolio: PortfolioKey
  selectedClientId: string | null
}

export function FiltroCarteira({
  portfolioOptions,
  clientOptions,
  selectedPortfolio,
  selectedClientId,
}: FiltroCarteiraProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateSearchParams(updater: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    updater(params)

    startTransition(() => {
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    })
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2 rounded-[22px] border border-slate-200 bg-slate-50 p-1.5">
        {portfolioOptions.map((portfolio) => {
          const isActive = portfolio.key === selectedPortfolio

          return (
            <button
              key={portfolio.key}
              type="button"
              onClick={() =>
                updateSearchParams((params) => {
                  params.set('carteira', portfolio.key)
                  params.delete('cliente')
                })
              }
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-slate-950 text-white shadow-sm'
                  : 'bg-transparent text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              {portfolio.label}
            </button>
          )
        })}
      </div>

      <div className="min-w-0 lg:w-[320px]">
        <label className="label">Cliente</label>
        <select
          className="input"
          value={selectedClientId ?? ''}
          onChange={(event) =>
            updateSearchParams((params) => {
              if (event.target.value) {
                params.set('cliente', event.target.value)
              } else {
                params.delete('cliente')
              }
            })
          }
        >
            <option value="">Todos os clientes</option>
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>
                {selectedPortfolio === 'all'
                  ? `${client.name} · ${client.portfolioLabel}`
                  : client.name}
              </option>
            ))}
          </select>
      </div>
    </div>
  )
}
