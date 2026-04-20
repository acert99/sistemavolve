'use client'

import { useMemo, useState } from 'react'
import type { LeadSource } from '@/types'
import { LEAD_SOURCE_LABELS } from '../constants'

interface ModalNovoLeadProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const sourceOptions: LeadSource[] = ['indicacao', 'instagram', 'site', 'outro']

export function ModalNovoLead({ open, onClose, onCreated }: ModalNovoLeadProps) {
  const [form, setForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    instagram: '',
    source: 'outro' as LeadSource,
    referredBy: '',
    servicesInterest: '',
    estimatedValue: '',
    notes: '',
    nextAction: '',
    nextActionDate: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showReferral = useMemo(() => form.source === 'indicacao', [form.source])

  if (!open) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        referredBy: showReferral ? form.referredBy : '',
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null,
        servicesInterest: form.servicesInterest
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    })
    const data = await response.json()

    if (!data.success) {
      setError(data.error ?? 'Nao foi possivel criar o lead')
      setSaving(false)
      return
    }

    setForm({
      name: '',
      company: '',
      phone: '',
      email: '',
      instagram: '',
      source: 'outro',
      referredBy: '',
      servicesInterest: '',
      estimatedValue: '',
      notes: '',
      nextAction: '',
      nextActionDate: '',
    })
    setSaving(false)
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-2xl rounded-[32px] border border-white/70 bg-white p-6 shadow-2xl">
        <div className="mb-5 space-y-2">
          <p className="panel-kicker">CRM</p>
          <h2 className="text-2xl font-semibold text-slate-950">Novo lead</h2>
          <p className="text-sm text-slate-500">
            Cadastre o contato, a origem e a proxima acao para o pipeline ja nascer acionavel.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Nome</label>
              <input
                required
                className="input"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div>
              <label className="label">Empresa</label>
              <input
                className="input"
                value={form.company}
                onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">WhatsApp</label>
              <input
                required
                className="input"
                placeholder="5511999999999"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label">Origem</label>
              <select
                className="input"
                value={form.source}
                onChange={(event) => setForm((current) => ({ ...current, source: event.target.value as LeadSource }))}
              >
                {sourceOptions.map((option) => (
                  <option key={option} value={option}>
                    {LEAD_SOURCE_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Instagram</label>
              <input
                className="input"
                value={form.instagram}
                onChange={(event) => setForm((current) => ({ ...current, instagram: event.target.value }))}
              />
            </div>
            <div>
              <label className="label">Valor estimado</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.estimatedValue}
                onChange={(event) => setForm((current) => ({ ...current, estimatedValue: event.target.value }))}
              />
            </div>
          </div>

          {showReferral ? (
            <div>
              <label className="label">Quem indicou</label>
              <input
                className="input"
                value={form.referredBy}
                onChange={(event) => setForm((current) => ({ ...current, referredBy: event.target.value }))}
              />
            </div>
          ) : null}

          <div>
            <label className="label">Interesse em servicos</label>
            <input
              className="input"
              placeholder="Gestao de trafego, social media, landing page"
              value={form.servicesInterest}
              onChange={(event) => setForm((current) => ({ ...current, servicesInterest: event.target.value }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Proxima acao</label>
              <input
                className="input"
                placeholder="Ligar, enviar mensagem, alinhar reuniao"
                value={form.nextAction}
                onChange={(event) => setForm((current) => ({ ...current, nextAction: event.target.value }))}
              />
            </div>
            <div>
              <label className="label">Quando</label>
              <input
                type="datetime-local"
                className="input"
                value={form.nextActionDate}
                onChange={(event) => setForm((current) => ({ ...current, nextActionDate: event.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Observacoes</label>
            <textarea
              rows={4}
              className="input resize-none"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>

          {error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Criar lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
