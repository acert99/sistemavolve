'use client'

import { useEffect, useState } from 'react'
import type { LeadStage } from '@/types'
import { LEAD_STAGE_LABELS } from '../constants'
import type { LeadDetail } from '../types'

interface LeadActionsProps {
  lead: LeadDetail
  onRefresh: () => void
}

export function LeadActions({ lead, onRefresh }: LeadActionsProps) {
  const [stage, setStage] = useState<LeadStage>(lead.stage)
  const [nextAction, setNextAction] = useState(lead.nextAction ?? '')
  const [nextActionDate, setNextActionDate] = useState(
    lead.nextActionDate ? new Date(lead.nextActionDate).toISOString().slice(0, 16) : '',
  )
  const [lostReason, setLostReason] = useState(lead.lostReason ?? '')
  const [savingStage, setSavingStage] = useState(false)
  const [showProposalForm, setShowProposalForm] = useState(false)
  const [proposalSaving, setProposalSaving] = useState(false)
  const [stageError, setStageError] = useState<string | null>(null)
  const [proposalError, setProposalError] = useState<string | null>(null)
  const [proposalForm, setProposalForm] = useState({
    titulo: `Proposta ${lead.name}`,
    descricao: lead.notes ?? '',
    itemNome: lead.servicesInterest[0] ?? 'Servico principal',
    itemDescricao: lead.servicesInterest.join(', '),
    quantidade: '1',
    valorUnitario:
      lead.estimatedValue !== null && lead.estimatedValue !== undefined
        ? String(lead.estimatedValue)
        : '',
    validade: '',
  })

  useEffect(() => {
    setStage(lead.stage)
    setNextAction(lead.nextAction ?? '')
    setNextActionDate(
      lead.nextActionDate ? new Date(lead.nextActionDate).toISOString().slice(0, 16) : '',
    )
    setLostReason(lead.lostReason ?? '')
    setProposalForm({
      titulo: `Proposta ${lead.name}`,
      descricao: lead.notes ?? '',
      itemNome: lead.servicesInterest[0] ?? 'Servico principal',
      itemDescricao: lead.servicesInterest.join(', '),
      quantidade: '1',
      valorUnitario:
        lead.estimatedValue !== null && lead.estimatedValue !== undefined
          ? String(lead.estimatedValue)
          : '',
      validade: '',
    })
  }, [lead])

  async function handleStageSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSavingStage(true)
    setStageError(null)

    const response = await fetch(`/api/leads/${lead.id}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage,
        nextAction: nextAction || null,
        nextActionDate: nextActionDate || null,
        lostReason: lostReason || null,
      }),
    })
    const data = await response.json()

    setSavingStage(false)

    if (!data.success) {
      setStageError(data.error ?? 'Nao foi possivel mover o lead')
      return
    }

    onRefresh()
  }

  async function handleCreateProposal(event: React.FormEvent) {
    event.preventDefault()
    setProposalSaving(true)
    setProposalError(null)

    const createResponse = await fetch('/api/propostas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: lead.id,
        titulo: proposalForm.titulo,
        descricao: proposalForm.descricao,
        validade: proposalForm.validade || null,
        itens: [
          {
            nome: proposalForm.itemNome,
            descricao: proposalForm.itemDescricao,
            quantidade: Number(proposalForm.quantidade || 1),
            valorUnitario: Number(proposalForm.valorUnitario || 0),
          },
        ],
      }),
    })
    const createData = await createResponse.json()

    if (!createData.success) {
      setProposalSaving(false)
      setProposalError(createData.error ?? 'Nao foi possivel criar a proposta')
      return
    }

    const sendResponse = await fetch(`/api/propostas/${createData.data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enviar' }),
    })
    const sendData = await sendResponse.json()

    setProposalSaving(false)

    if (!sendData.success) {
      setProposalError(sendData.error ?? 'A proposta foi criada, mas nao foi enviada')
      return
    }

    setShowProposalForm(false)
    onRefresh()
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleStageSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Mover etapa</label>
            <select
              className="input"
              value={stage}
              onChange={(event) => setStage(event.target.value as LeadStage)}
            >
              {Object.entries(LEAD_STAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Proxima acao</label>
            <input
              className="input"
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Quando</label>
            <input
              type="datetime-local"
              className="input"
              value={nextActionDate}
              onChange={(event) => setNextActionDate(event.target.value)}
            />
          </div>
          <div>
            <label className="label">Motivo da perda</label>
            <input
              className="input"
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              disabled={stage !== 'lost'}
            />
          </div>
        </div>

        {stageError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {stageError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={savingStage} className="btn-primary">
            {savingStage ? 'Salvando...' : 'Atualizar etapa'}
          </button>
          <button type="button" onClick={() => setShowProposalForm((current) => !current)} className="btn-secondary">
            {showProposalForm ? 'Fechar proposta' : 'Gerar proposta'}
          </button>
        </div>
      </form>

      {showProposalForm ? (
        <form onSubmit={handleCreateProposal} className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">Criar e enviar proposta</h3>
            <p className="text-sm text-slate-500">
              A proposta nasce ligada ao lead e, quando enviada, ativa a etapa `proposal` com cadencia automatica.
            </p>
          </div>

          <div>
            <label className="label">Titulo</label>
            <input
              required
              className="input"
              value={proposalForm.titulo}
              onChange={(event) => setProposalForm((current) => ({ ...current, titulo: event.target.value }))}
            />
          </div>

          <div>
            <label className="label">Descricao</label>
            <textarea
              rows={3}
              className="input resize-none"
              value={proposalForm.descricao}
              onChange={(event) => setProposalForm((current) => ({ ...current, descricao: event.target.value }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Servico / item</label>
              <input
                required
                className="input"
                value={proposalForm.itemNome}
                onChange={(event) => setProposalForm((current) => ({ ...current, itemNome: event.target.value }))}
              />
            </div>
            <div>
              <label className="label">Validade</label>
              <input
                type="date"
                className="input"
                value={proposalForm.validade}
                onChange={(event) => setProposalForm((current) => ({ ...current, validade: event.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Descricao do item</label>
            <input
              className="input"
              value={proposalForm.itemDescricao}
              onChange={(event) => setProposalForm((current) => ({ ...current, itemDescricao: event.target.value }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Quantidade</label>
              <input
                required
                type="number"
                min="1"
                step="1"
                className="input"
                value={proposalForm.quantidade}
                onChange={(event) => setProposalForm((current) => ({ ...current, quantidade: event.target.value }))}
              />
            </div>
            <div>
              <label className="label">Valor unitario</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={proposalForm.valorUnitario}
                onChange={(event) => setProposalForm((current) => ({ ...current, valorUnitario: event.target.value }))}
              />
            </div>
          </div>

          {proposalError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {proposalError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button type="submit" disabled={proposalSaving} className="btn-primary">
              {proposalSaving ? 'Enviando proposta...' : 'Criar e enviar'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
