'use client'

import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/panel/page-header'
import type { ItemProposta } from '@/types'

type ClienteOption = {
  id: string
  nome: string
  email: string
}

type LeadOption = {
  id: string
  name: string
  email: string | null
  company: string | null
}

type TargetType = 'cliente' | 'lead'

type FormItem = ItemProposta & { tempId: string }

function currencyToNumber(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
  return Number(normalized || 0)
}

function buildEmptyItem(): FormItem {
  return {
    tempId: crypto.randomUUID(),
    nome: '',
    descricao: '',
    quantidade: 1,
    valorUnitario: 0,
  }
}

export default function NovaPropostaPage() {
  const router = useRouter()
  const [targetType, setTargetType] = useState<TargetType>('cliente')
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [targetId, setTargetId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [validade, setValidade] = useState('')
  const [itens, setItens] = useState<FormItem[]>([buildEmptyItem()])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOptions() {
      setLoading(true)
      setError(null)

      try {
        const [clientesRes, leadsRes] = await Promise.all([
          fetch('/api/clientes?limit=100&ativo=true', { cache: 'no-store' }),
          fetch('/api/leads?limit=100', { cache: 'no-store' }),
        ])

        const [clientesData, leadsData] = await Promise.all([
          clientesRes.json(),
          leadsRes.json(),
        ])

        if (!clientesData.success) throw new Error(clientesData.error ?? 'Falha ao listar clientes')
        if (!leadsData.success) throw new Error(leadsData.error ?? 'Falha ao listar leads')

        setClientes(clientesData.data)
        setLeads(leadsData.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar opcoes')
      } finally {
        setLoading(false)
      }
    }

    fetchOptions()
  }, [])

  const valorTotal = useMemo(
    () => itens.reduce((sum, item) => sum + item.quantidade * item.valorUnitario, 0),
    [itens],
  )

  function updateItem(tempId: string, patch: Partial<FormItem>) {
    setItens((current) =>
      current.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item)),
    )
  }

  function removeItem(tempId: string) {
    setItens((current) => current.length > 1 ? current.filter((item) => item.tempId !== tempId) : current)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const normalizedItems = itens
      .map(({ tempId: _tempId, ...item }) => ({
        ...item,
        nome: item.nome.trim(),
        descricao: item.descricao?.trim() || undefined,
        quantidade: Number(item.quantidade || 1),
        valorUnitario: Number(item.valorUnitario || 0),
      }))
      .filter((item) => item.nome && item.quantidade > 0 && item.valorUnitario >= 0)

    if (!targetId || !titulo.trim() || normalizedItems.length === 0) {
      setError('Selecione um cliente/lead, informe titulo e ao menos um item valido.')
      setSaving(false)
      return
    }

    try {
      const response = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: targetType === 'cliente' ? targetId : undefined,
          leadId: targetType === 'lead' ? targetId : undefined,
          titulo: titulo.trim(),
          descricao: descricao.trim() || undefined,
          validade: validade || undefined,
          itens: normalizedItems,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Nao foi possivel criar a proposta')
      }

      router.push('/painel/propostas')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar proposta')
    } finally {
      setSaving(false)
    }
  }

  const targetOptions = targetType === 'cliente' ? clientes : leads

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercial"
        title="Nova proposta"
        description="Crie uma proposta vinculada a um cliente ativo ou a um lead em aberto. Ela nasce como rascunho e pode ser enviada depois pela tela de propostas."
        meta={[{ label: 'Rascunho' }]}
      />

      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="label">Tipo de contato</span>
            <select
              className="input"
              value={targetType}
              onChange={(event) => {
                setTargetType(event.target.value as TargetType)
                setTargetId('')
              }}
            >
              <option value="cliente">Cliente</option>
              <option value="lead">Lead</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="label">{targetType === 'cliente' ? 'Cliente' : 'Lead'}</span>
            <select
              className="input"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              disabled={loading}
            >
              <option value="">Selecione...</option>
              {targetOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {'nome' in option
                    ? `${option.nome} — ${option.email}`
                    : `${option.name}${option.company ? ` — ${option.company}` : ''}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.4fr,0.6fr]">
          <label className="space-y-2">
            <span className="label">Titulo</span>
            <input
              className="input"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Ex: Proposta de gestão de conteúdo"
            />
          </label>

          <label className="space-y-2">
            <span className="label">Validade</span>
            <input
              type="date"
              className="input"
              value={validade}
              onChange={(event) => setValidade(event.target.value)}
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="label">Descricao</span>
          <textarea
            rows={4}
            className="input resize-none"
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
            placeholder="Contexto comercial, escopo e observacoes importantes."
          />
        </label>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">Itens</h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setItens((current) => [...current, buildEmptyItem()])}
            >
              Adicionar item
            </button>
          </div>

          {itens.map((item) => (
            <div key={item.tempId} className="rounded-[24px] border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-[1.2fr,0.45fr,0.55fr,auto]">
                <input
                  className="input"
                  value={item.nome}
                  onChange={(event) => updateItem(item.tempId, { nome: event.target.value })}
                  placeholder="Nome do item"
                />
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={item.quantidade}
                  onChange={(event) => updateItem(item.tempId, { quantidade: Number(event.target.value) })}
                  placeholder="Qtd"
                />
                <input
                  className="input"
                  value={item.valorUnitario || ''}
                  onChange={(event) => updateItem(item.tempId, { valorUnitario: currencyToNumber(event.target.value) })}
                  placeholder="Valor"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => removeItem(item.tempId)}
                >
                  Remover
                </button>
              </div>
              <textarea
                rows={2}
                className="input mt-3 resize-none"
                value={item.descricao ?? ''}
                onChange={(event) => updateItem(item.tempId, { descricao: event.target.value })}
                placeholder="Descricao opcional do item"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-100 pt-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">Total da proposta</p>
            <p className="text-2xl font-bold text-volve-700">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
            </p>
          </div>

          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => router.push('/painel/propostas')}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving || loading}>
              {saving ? 'Criando...' : 'Criar proposta'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
