'use client'

import { useEffect, useState } from 'react'
import { CalendarIcon, SparkIcon } from '@/components/panel/icons'
import { EmptyState } from '@/components/panel/empty-state'
import { PageHeader } from '@/components/panel/page-header'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

type ClienteLista = {
  id: string
  name: string
  portfolioKey: string
  portfolioLabel: string
}

type ClickUpTaskRaw = {
  id: string
  name: string
  url: string
  status: { status: string; color?: string | null }
  due_date?: string | null
  list?: { id: string; name: string }
  _portfolio?: string
}

type IdeiaGerada = {
  titulo: string
  formato: string
  dataSugerida: string
  justificativa: string
  _status?: 'pendente' | 'aprovada' | 'descartada'
  _taskUrl?: string
}

export default function IdeiasPage() {
  const now = new Date()
  const [ano, setAno] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)

  const [clientes, setClientes] = useState<ClienteLista[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteLista | null>(null)
  const [loadingClientes, setLoadingClientes] = useState(true)

  const [tarefas, setTarefas] = useState<ClickUpTaskRaw[]>([])
  const [loadingTarefas, setLoadingTarefas] = useState(false)
  const [erroTarefas, setErroTarefas] = useState<string | null>(null)

  const [ideias, setIdeias] = useState<IdeiaGerada[]>([])
  const [gerando, setGerando] = useState(false)
  const [erroGeracao, setErroGeracao] = useState<string | null>(null)

  const [aprovandoIdx, setAprovandoIdx] = useState<number | null>(null)
  const [dataAprovacao, setDataAprovacao] = useState('')
  const [salvandoAprovacao, setSalvandoAprovacao] = useState(false)

  async function fetchClientes() {
    setLoadingClientes(true)
    try {
      const res = await fetch('/api/calendario-conteudo/listas')
      const data = await res.json()
      if (data.success) setClientes(data.data)
    } catch {
      // silencioso
    } finally {
      setLoadingClientes(false)
    }
  }

  async function fetchTarefas(y: number, m: number, listId: string) {
    setLoadingTarefas(true)
    setErroTarefas(null)
    try {
      const res = await fetch(`/api/calendario-conteudo/tarefas?year=${y}&month=${m}&listId=${listId}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Erro ao buscar tarefas')
      setTarefas(data.data)
    } catch (err) {
      setErroTarefas(err instanceof Error ? err.message : 'Erro ao buscar tarefas')
    } finally {
      setLoadingTarefas(false)
    }
  }

  useEffect(() => {
    fetchClientes()
  }, [])

  useEffect(() => {
    if (clienteSelecionado) {
      setTarefas([])
      setIdeias([])
      fetchTarefas(ano, mes, clienteSelecionado.id)
    }
  }, [clienteSelecionado, ano, mes])

  function navMes(delta: number) {
    let m = mes + delta
    let a = ano
    if (m < 1) { m = 12; a-- }
    if (m > 12) { m = 1; a++ }
    setMes(m)
    setAno(a)
    setIdeias([])
  }

  async function handleGerarIdeias() {
    if (!clienteSelecionado) return
    setGerando(true)
    setErroGeracao(null)
    setIdeias([])

    try {
      const res = await fetch('/api/calendario-conteudo/ideias/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: ano,
          month: mes,
          listId: clienteSelecionado.id,
          clientName: clienteSelecionado.name,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Erro ao gerar ideias')
      setIdeias(data.data.map((i: IdeiaGerada) => ({ ...i, _status: 'pendente' })))
    } catch (err) {
      setErroGeracao(err instanceof Error ? err.message : 'Erro ao gerar ideias')
    } finally {
      setGerando(false)
    }
  }

  function handleDescartar(idx: number) {
    setIdeias((prev) => prev.map((i, n) => n === idx ? { ...i, _status: 'descartada' } : i))
  }

  function handleAbrirAprovacao(idx: number) {
    setDataAprovacao(ideias[idx].dataSugerida ?? '')
    setAprovandoIdx(idx)
  }

  async function handleConfirmarAprovacao() {
    if (aprovandoIdx === null || !clienteSelecionado) return
    setSalvandoAprovacao(true)
    const ideia = ideias[aprovandoIdx]

    try {
      const res = await fetch('/api/calendario-conteudo/ideias/aprovar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listId: clienteSelecionado.id,
          titulo: ideia.titulo,
          formato: ideia.formato,
          dataSugerida: dataAprovacao || ideia.dataSugerida,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Erro ao criar tarefa no ClickUp')

      setIdeias((prev) =>
        prev.map((item, i) =>
          i === aprovandoIdx ? { ...item, _status: 'aprovada', _taskUrl: data.data.taskUrl } : item,
        ),
      )
      setAprovandoIdx(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao aprovar')
    } finally {
      setSalvandoAprovacao(false)
    }
  }

  const ideiasVisiveis = ideias.filter((i) => i._status !== 'descartada')
  const aprovadas = ideiasVisiveis.filter((i) => i._status === 'aprovada').length
  const pendentes = ideiasVisiveis.filter((i) => i._status === 'pendente').length

  // Agrupar clientes por portfólio
  const portfolios = [...new Set(clientes.map((c) => c.portfolioLabel))]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Calendario de Conteudo"
        title="Ideias por cliente"
        description="Selecione um cliente, veja as tarefas do mes no ClickUp e gere sugestoes de conteudo com IA."
        meta={[
          { label: `${MESES[mes - 1]} ${ano}` },
          ...(clienteSelecionado ? [{ label: clienteSelecionado.name }] : []),
          ...(ideias.length > 0
            ? [
                { label: `${aprovadas} aprovada${aprovadas !== 1 ? 's' : ''}`, tone: 'success' as const },
                { label: `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`, tone: 'warning' as const },
              ]
            : []),
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navMes(-1)} className="btn-secondary">‹</button>
            <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center">
              {MESES[mes - 1]} {ano}
            </span>
            <button type="button" onClick={() => navMes(1)} className="btn-secondary">›</button>
          </div>
        }
      />

      {/* Seletor de cliente */}
      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100">
            <CalendarIcon className="h-4 w-4 text-slate-600" />
          </div>
          <h2 className="section-title">Selecione o cliente</h2>
        </div>

        {loadingClientes ? (
          <p className="text-sm text-slate-500">Carregando clientes do ClickUp...</p>
        ) : clientes.length === 0 ? (
          <p className="text-sm text-rose-600">Nenhum cliente encontrado. Verifique as variaveis de ambiente do ClickUp.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {portfolios.map((portfolio) => (
              <div key={portfolio} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{portfolio}</p>
                <div className="flex flex-wrap gap-2">
                  {clientes
                    .filter((c) => c.portfolioLabel === portfolio)
                    .map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => setClienteSelecionado(cliente)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                          clienteSelecionado?.id === cliente.id
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {cliente.name}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {clienteSelecionado ? (
        <div className="grid gap-6 xl:grid-cols-[1fr,1.4fr]">
          {/* Tarefas do cliente no mês */}
          <section>
            <div className="card space-y-4">
              <div>
                <h2 className="section-title">Tarefas de {clienteSelecionado.name}</h2>
                <p className="section-copy">
                  {loadingTarefas
                    ? 'Buscando...'
                    : `${tarefas.length} tarefa${tarefas.length !== 1 ? 's' : ''} em ${MESES[mes - 1]}`}
                </p>
              </div>

              {erroTarefas ? (
                <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {erroTarefas}
                </div>
              ) : loadingTarefas ? (
                <div className="py-8 text-center text-sm text-slate-500">Consultando ClickUp...</div>
              ) : tarefas.length === 0 ? (
                <EmptyState
                  icon={<CalendarIcon className="h-6 w-6" />}
                  title="Sem tarefas neste mês"
                  description={`${clienteSelecionado.name} não tem tarefas com prazo em ${MESES[mes - 1]}.`}
                />
              ) : (
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {tarefas.map((tarefa) => (
                    <a
                      key={tarefa.id}
                      href={tarefa.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm transition-colors hover:bg-slate-100"
                    >
                      <span
                        className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: tarefa.status.color ?? '#94a3b8' }}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{tarefa.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {tarefa.status.status}
                          {tarefa.due_date
                            ? ` · ${new Date(Number(tarefa.due_date)).toLocaleDateString('pt-BR')}`
                            : ''}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Ideias de IA */}
          <section>
            <div className="card space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-200 bg-violet-50">
                    <SparkIcon className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <h2 className="section-title">Sugestoes para {clienteSelecionado.name}</h2>
                    <p className="section-copy">Ideias geradas com IA baseadas no contexto do cliente</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGerarIdeias}
                  disabled={gerando}
                  className="btn-primary"
                >
                  {gerando ? 'Gerando...' : 'Gerar ideias'}
                </button>
              </div>

              {erroGeracao ? (
                <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {erroGeracao}
                </div>
              ) : null}

              {ideias.length === 0 && !gerando ? (
                <EmptyState
                  icon={<SparkIcon className="h-6 w-6" />}
                  title="Nenhuma ideia gerada ainda"
                  description={`Clique em "Gerar ideias" para criar sugestoes de conteudo para ${clienteSelecionado.name}.`}
                />
              ) : gerando ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  Analisando tarefas e gerando ideias com IA...
                </div>
              ) : (
                <div className="space-y-3">
                  {ideiasVisiveis.map((ideia) => {
                    const idxOriginal = ideias.indexOf(ideia)
                    const isAprovando = aprovandoIdx === idxOriginal

                    return (
                      <article
                        key={idxOriginal}
                        className={`rounded-[20px] border p-4 transition-colors ${
                          ideia._status === 'aprovada'
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="badge-blue">{ideia.formato}</span>
                            {ideia.dataSugerida ? (
                              <span className="badge-gray">
                                {new Date(ideia.dataSugerida + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            ) : null}
                            {ideia._status === 'aprovada' ? <span className="badge-green">Aprovada</span> : null}
                          </div>

                          <p className="text-sm font-semibold text-slate-900">{ideia.titulo}</p>
                          <p className="text-xs leading-5 text-slate-500">{ideia.justificativa}</p>

                          {ideia._status === 'aprovada' && ideia._taskUrl ? (
                            <a
                              href={ideia._taskUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                            >
                              Ver no ClickUp →
                            </a>
                          ) : null}

                          {ideia._status === 'pendente' && !isAprovando ? (
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleAbrirAprovacao(idxOriginal)}
                                className="btn-primary"
                              >
                                Aprovar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDescartar(idxOriginal)}
                                className="btn-secondary"
                              >
                                Descartar
                              </button>
                            </div>
                          ) : null}

                          {isAprovando ? (
                            <div className="mt-3 space-y-3 rounded-[16px] border border-violet-200 bg-violet-50 p-3">
                              <div>
                                <label className="label">
                                  Criar no ClickUp em: <strong>{clienteSelecionado.name}</strong>
                                </label>
                              </div>
                              <div>
                                <label className="label">Data de entrega</label>
                                <input
                                  type="date"
                                  className="input"
                                  value={dataAprovacao}
                                  onChange={(e) => setDataAprovacao(e.target.value)}
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleConfirmarAprovacao}
                                  disabled={salvandoAprovacao}
                                  className="btn-primary"
                                >
                                  {salvandoAprovacao ? 'Criando no ClickUp...' : 'Confirmar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAprovandoIdx(null)}
                                  className="btn-secondary"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="card py-12 text-center">
          <p className="text-sm text-slate-500">Selecione um cliente acima para ver as tarefas e gerar ideias.</p>
        </div>
      )}
    </div>
  )
}
