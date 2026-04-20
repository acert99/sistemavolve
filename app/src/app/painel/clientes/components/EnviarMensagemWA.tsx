'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LeadStage, TemplateMensagem } from '@/types'
import { buildNextHourDateTimeLocalInput } from '@/lib/timezone'

interface EnviarMensagemWAProps {
  leadId: string
  leadStage: LeadStage
  onSent: () => void
}

export function EnviarMensagemWA({ leadId, leadStage, onSent }: EnviarMensagemWAProps) {
  const [templates, setTemplates] = useState<TemplateMensagem[]>([])
  const [templateId, setTemplateId] = useState('')
  const [message, setMessage] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTemplates() {
      const response = await fetch(`/api/message-templates?stage=${leadStage}`, {
        cache: 'no-store',
      })
      const data = await response.json()

      if (data.success) {
        setTemplates(data.data)
      }
    }

    loadTemplates()
  }, [leadStage])

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates],
  )

  useEffect(() => {
    if (selectedTemplate) {
      setMessage(selectedTemplate.conteudo)
    }
  }, [selectedTemplate])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const response = await fetch(`/api/leads/${leadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: templateId || null,
        message,
        scheduledAt: scheduledAt || null,
      }),
    })
    const data = await response.json()

    if (!data.success) {
      setSaving(false)
      setError(data.error ?? 'Nao foi possivel enviar a mensagem')
      return
    }

    setSaving(false)
    setTemplateId('')
    setMessage('')
    setScheduledAt('')
    onSent()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Template</label>
          <select
            className="input"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">Mensagem livre</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Agendar para</label>
          <input
            type="datetime-local"
            className="input"
            value={scheduledAt}
            placeholder={buildNextHourDateTimeLocalInput()}
            onChange={(event) => setScheduledAt(event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Mensagem</label>
        <textarea
          rows={6}
          className="input resize-none"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>

      {selectedTemplate ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          Variaveis disponiveis: {'{{nome}}'}, {'{{empresa}}'}, {'{{quem_indicou}}'}, {'{{dia_hora}}'}, {'{{link_proposta}}'}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Enviando...' : scheduledAt ? 'Agendar mensagem' : 'Enviar agora'}
        </button>
      </div>
    </form>
  )
}
