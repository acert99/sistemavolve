'use client'

import { useEffect, useState } from 'react'
import { CalendarIcon, SparkIcon } from '@/components/panel/icons'
import { EmptyState } from '@/components/panel/empty-state'
import { PageHeader } from '@/components/panel/page-header'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

type ClickUpTaskRaw = {
  id: string
  name: string
  url: string
  status: { status: string; color?: string | null }
  due_date?: string | null
  list?: { id: string; name: string }
  folder?: { id: string; name: string }
  _portfolio?: string
}

type ClickUpList = {
  id: string
  name: string
  folder?: { id: string; name: string }
}

type IdeiaGerada = {
  titulo: string
  formato: string
  dataSugerida: string
  justificativa: string
  _status?: 'pendente' | 'aprovada' | 'descartada'
  _taskUrl?: string
}

type AprovarForm = {
  listId: string
  dataSugerida: string
}

export default function IdeiasPage() {
  const now = new Date()
  const [ano, setAno] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)

  const [tarefas, setTarefas] = useState<ClickUpTaskRaw[]>([])
  const [loadingTarefas, setLoadingTarefas] = useState(true)
  const [erroTarefas, setErroTarefas] = useState<string | null>(null)

  const [listas, setListas] = useState<ClickUpList[]>([])

  const [ideias, setIdeias] = useState<IdeiaGerada[]>([])
  const [gerando, setGerando] = useState(false)
  const [erroGeracao, setErroGeracao] = useState<string | null>(null)

  const [aprovandoIdx, setAprovandoIdx] = useState<number | null>(null)
  const [aprovarForm, setAprovarForm] = useState<AprovarForm>({ listId: '', dataSugerida: '' })
  const [salvandoAprovacao, setSalvandoAprovacao] = useState(false)

  async function fetchTarefas(y: number, m: number) {
    setLoadingTarefas(true)
    setErroTarefas(null)

    try {
      const res = await fetch(`/api/calendario-conteudo/tarefas?year=${y}&month=${m}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Erro ao buscar tarefas')
      setTarefas(data.data)
    } catch (err) {
      setErroTarefas(err instanceof Error ? err.message : 'Erro ao buscar tarefas do ClickUp')
    } finally {
      setLoadingTarefas(false)
    }
  }

  async function fetchListas() {
    try {
      const res = await fetch(`/api/calendario-conteudo/tarefas?year=${now.getFullYear()}&month=1`)
      const data = await res.json()
      if (data.success) {
        const uniqueLists = new Map<string, ClickUpList>()
        for (const task of data.data as ClickUpTaskRaw[]) {
          if (task.list?.id && !uniqueLists.has(task.list.id)) {
            uniqueLists.set(task.list.id, { id: task.list.id, name: task.list.name, folder: task.folder })
          }
        }
        setListas(Array.from(uniqueLists.values()))
      }
    } catch {
      // listas ficam vazias, usuario digita o ID manualmente
    }
  }

  useEffect(() => {
    fetchTarefas(ano, mes)
    fetchListas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function navMes(delta: number) {
    let m = mes + delta
    let a = ano
    if (m < 1) { m = 12; a-- }
    if (m > 12) { m = 1; a++ }
    setMes(m)
    setAno(a)
    fetchTarefas(a, m)
    setIdeias([])
  }

  async function handleGerarIdeias() {
    setGerando(true)
    setErroGeracao(null)
    setIdeias([])

    try {
      const res = await fetch('/api/calendario-conteudo/ideias/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: ano, month: mes }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Erro ao gerar ideias')
      setIdeias(data.data.map((ideia: IdeiaGerada) => ({ ...ideia, _status: 'pendente' })))
    } catch (err) {
      setErroGeracao(err instanceof Error ? err.message : 'Erro ao gerar ideias')
    } finally {
      setGerando(false)
    }
  }

  function handleDescartar(idx: number) {
    setIdeias((prev) => prev.map((ideia, i) => i === idx ? { ...ideia, _status: 'descartada' } : ideia))
  }

  function handleAbrirAprovacao(idx: number) {
    const ideia = ideias[idx]
    setAprovarForm({ listId: listas[0]?.id ?? '', dataSugerida: ideia.dataSugerida ?? '' })
    setAprovandoIdx(idx)
  }

  async function handleConfirmarAprovacao() {
    if (aprovandoIdx === null) return
    setSalvandoAprovacao(true)

    const ideia = ideias[aprovandoIdx]

    try {
      const res = await fetch('/api/calendario-conteudo/ideias/aprovar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listId: aprovarForm.listId,
          titulo: ideia.titulo,
          formato: ideia.formato,
          dataSugerida: aprovarForm.dataSugerida || ideia.dataSugerida,
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
      alert(err instanceof Error ? err.message : 'Erro ao aprovar ideia')
    } finally {
      setSalvandoAprovacao(false)
    }
  }

  const ideiasVisiveis = ideias.filter((i) => i._status !== 'descartada')
  const pendentes = ideiasVisiveis.filter((i) => i._status === 'pendente').length
  const aprovadas = ideiasVisiveis.filter((i) => i._status === 'aprovada').length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Calendario de Conteudo"
        title="Ideias geradas por IA"
        description="Visualize as tarefas do mes no ClickUp e aprove sugestoes de conteudo geradas pela IA diretamente para o ClickUp."
        meta={[
          { label: `${MESES[mes - 1]} ${ano}` },
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
            <span className="text-sm font-semibold text-slate-700">{MESES[mes - 1]} {ano}</span>
            <button type="button" onClick={() => navMes(1)} className="btn-secondary">›</button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr,1.4fr]">
        <section className="space-y-4">
          <div className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100">
                <CalendarIcon className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <h2 className="section-title">Tarefas no ClickUp</h2>
                <p className="section-copy">
                  {loadingTarefas
                    ? 'Consultando...'
                    : `${tarefas.length} tarefa${tarefas.length !== 1 ? 's' : ''} com prazo em ${MESES[mes - 1]}`}
                </p>
              </div>
            </div>

            {erroTarefas ? (
              <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {erroTarefas}
              </div>
            ) : loadingTarefas ? (
              <div className="py-8 text-center text-sm text-slate-500">Buscando tarefas do ClickUp...</div>
            ) : tarefas.length === 0 ? (
              <EmptyState
                icon={<CalendarIcon className="h-6 w-6" />}
                title="Sem tarefas com prazo neste mes"
                description="Nenhuma tarefa com due date cadastrado no ClickUp para este periodo."
              />
            ) : (
              <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
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
                        {tarefa.list?.name ?? tarefa._portfolio ?? '—'}
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

        <section className="space-y-4">
          <div className="card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50">
                  <SparkIcon className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="section-title">Sugestoes de IA</h2>
                  <p className="section-copy">Ideias geradas com base no que ja existe no ClickUp</p>
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
                description={`Clique em "Gerar ideias" para receber sugestoes de conteudo para ${MESES[mes - 1]}.`}
              />
            ) : gerando ? (
              <div className="py-8 text-center text-sm text-slate-500">
                Consultando o ClickUp e gerando ideias com IA...
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
                        <div className="flex flex-wrap items-start gap-2">
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
                              <label className="label">Cliente / Lista no ClickUp</label>
                              {listas.length > 0 ? (
                                <select
                                  className="input"
                                  value={aprovarForm.listId}
                                  onChange={(e) => setAprovarForm((f) => ({ ...f, listId: e.target.value }))}
                                >
                                  <option value="">Selecione...</option>
                                  {listas.map((lista) => (
                                    <option key={lista.id} value={lista.id}>
                                      {lista.name}{lista.folder ? ` (${lista.folder.name})` : ''}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  className="input"
                                  placeholder="ID da lista no ClickUp"
                                  value={aprovarForm.listId}
                                  onChange={(e) => setAprovarForm((f) => ({ ...f, listId: e.target.value }))}
                                />
                              )}
                            </div>
                            <div>
                              <label className="label">Data de entrega</label>
                              <input
                                type="date"
                                className="input"
                                value={aprovarForm.dataSugerida}
                                onChange={(e) => setAprovarForm((f) => ({ ...f, dataSugerida: e.target.value }))}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleConfirmarAprovacao}
                                disabled={salvandoAprovacao || !aprovarForm.listId}
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
    </div>
  )
}
