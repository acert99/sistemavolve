'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { EmptyState } from '@/components/panel/empty-state'
import {
  ArrowRightIcon,
  CalendarIcon,
  CommunicationIcon,
  SparkIcon,
  WhatsAppIcon,
} from '@/components/panel/icons'
import { MetricCard } from '@/components/panel/metric-card'
import { PageHeader } from '@/components/panel/page-header'
import {
  APP_TIME_ZONE,
  buildNextHourDateTimeLocalInput,
  formatDateTimeInAppTimeZone,
  getDateKeyInAppTimeZone,
  toDateTimeLocalInputValue,
  toIsoStringInAppTimeZone,
} from '@/lib/timezone'

type ClienteOption = {
  id: string
  nome: string
  email: string
  whatsapp: string | null
}

type TemplateMensagem = {
  id: string
  nome: string
  categoria: string | null
  conteudo: string
  ativo: boolean
  createdAt: string
}

type MensagemAgendada = {
  id: string
  clienteId: string
  templateId: string | null
  conteudoMensagem: string
  agendadoPara: string
  status: string
  externalMessageId: string | null
  enviadoEm: string | null
  mensagemErro: string | null
  cliente?: ClienteOption
  template?: { id: string; nome: string; categoria: string | null } | null
}

type WhatsAppStatus = {
  status: string
  connected: boolean
  rawState: string
  phoneNumber: string | null
  lastConnectionAt: string | null
  lastError: string | null
}

const statusBadge: Record<string, string> = {
  connected: 'badge-green',
  awaiting_qr: 'badge-yellow',
  disconnected: 'badge-gray',
  error: 'badge-red',
  unknown: 'badge-gray',
}

const statusLabel: Record<string, string> = {
  connected: 'Conectado',
  awaiting_qr: 'Aguardando QR',
  disconnected: 'Desconectado',
  error: 'Erro de conexao',
  unknown: 'Estado indefinido',
}

const scheduleBadge: Record<string, string> = {
  scheduled: 'badge-blue',
  processing: 'badge-yellow',
  sent: 'badge-green',
  delivered: 'badge-green',
  read: 'badge-green',
  canceled: 'badge-gray',
  failed: 'badge-red',
}

const scheduleLabel: Record<string, string> = {
  scheduled: 'Agendada',
  processing: 'Processando',
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  canceled: 'Cancelada',
  failed: 'Falhou',
}

function ComunicacaoPageContent() {
  const searchParams = useSearchParams()
  const clienteParam = searchParams.get('clienteId') ?? ''

  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [templates, setTemplates] = useState<TemplateMensagem[]>([])
  const [mensagens, setMensagens] = useState<MensagemAgendada[]>([])
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [savingMessage, setSavingMessage] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [executorNotice, setExecutorNotice] = useState(
    'Os agendamentos ficam persistidos e podem ser editados. O painel valida a configuracao do executor automaticamente.',
  )
  const [messageForm, setMessageForm] = useState({
    clienteId: clienteParam,
    templateId: '',
    conteudoMensagem: '',
    agendadoPara: buildNextHourDateTimeLocalInput(),
  })
  const [templateForm, setTemplateForm] = useState({
    nome: '',
    categoria: '',
    conteudo: '',
  })

  async function fetchData() {
    setLoading(true)
    setError(null)

    try {
      const [statusRes, templatesRes, mensagensRes, clientesRes] = await Promise.all([
        fetch('/api/communication/whatsapp/status', { cache: 'no-store' }),
        fetch('/api/communication/templates', { cache: 'no-store' }),
        fetch('/api/communication/scheduled-messages', { cache: 'no-store' }),
        fetch('/api/clientes?limit=100&ativo=true', { cache: 'no-store' }),
      ])

      const [statusData, templatesData, mensagensData, clientesData] = await Promise.all([
        statusRes.json(),
        templatesRes.json(),
        mensagensRes.json(),
        clientesRes.json(),
      ])

      if (!statusData.success) throw new Error(statusData.error ?? 'Falha ao consultar canal')
      if (!templatesData.success) throw new Error(templatesData.error ?? 'Falha ao listar templates')
      if (!mensagensData.success) throw new Error(mensagensData.error ?? 'Falha ao listar mensagens')
      if (!clientesData.success) throw new Error(clientesData.error ?? 'Falha ao listar clientes')

      setStatus(statusData.data)
      setTemplates(templatesData.data)
      setMensagens(mensagensData.data)
      setClientes(clientesData.data)

      setExecutorNotice(
        mensagensData.meta?.executorConfigured === false
          ? 'Os agendamentos ficam persistidos e podem ser editados, mas o disparo automatico ainda depende de uma rotina de execucao na infraestrutura.'
          : 'Os agendamentos estao com executor configurado e devem ser disparados automaticamente no horario programado.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar modulo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!messageForm.clienteId && clienteParam) {
      setMessageForm((current) => ({ ...current, clienteId: clienteParam }))
      setShowMessageModal(true)
    }
  }, [clienteParam, messageForm.clienteId])

  const scheduledToday = useMemo(() => {
    const today = getDateKeyInAppTimeZone(new Date())
    return mensagens.filter((mensagem) => {
      const scheduleDate = getDateKeyInAppTimeZone(mensagem.agendadoPara)
      return mensagem.status === 'scheduled' && scheduleDate === today
    }).length
  }, [mensagens])

  const activeTemplates = useMemo(
    () => templates.filter((template) => template.ativo).length,
    [templates],
  )

  function resetMessageForm() {
    setEditingMessageId(null)
    setMessageForm({
      clienteId: clienteParam,
      templateId: '',
      conteudoMensagem: '',
      agendadoPara: buildNextHourDateTimeLocalInput(),
    })
  }

  function resetTemplateForm() {
    setTemplateForm({ nome: '', categoria: '', conteudo: '' })
  }

  async function handleConnectWhatsApp() {
    setConnecting(true)
    setQrCode(null)
    setQrError(null)

    try {
      const res = await fetch('/api/communication/whatsapp/connect', { method: 'POST' })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error ?? 'Nao foi possivel iniciar a conexao')
      }

      if (data.data?.qrcode) {
        setQrCode(data.data.qrcode)
        const poll = setInterval(async () => {
          const statusRes = await fetch('/api/communication/whatsapp/status', { cache: 'no-store' })
          const statusData = await statusRes.json()
          if (statusData.data?.connected) {
            clearInterval(poll)
            setQrCode(null)
            fetchData()
          }
        }, 5000)
        setTimeout(() => {
          clearInterval(poll)
          setQrCode(null)
          fetchData()
        }, 60000)
      } else if (data.data?.error) {
        setQrError(data.data.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir conexao do WhatsApp')
    } finally {
      setConnecting(false)
      fetchData()
    }
  }

  async function handleSubmitTemplate(event: React.FormEvent) {
    event.preventDefault()
    setSavingTemplate(true)

    try {
      const res = await fetch('/api/communication/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm),
      })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error ?? 'Nao foi possivel criar o template')
      }

      setShowTemplateModal(false)
      resetTemplateForm()
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar template')
    } finally {
      setSavingTemplate(false)
    }
  }

  async function handleSubmitMessage(event: React.FormEvent) {
    event.preventDefault()
    setSavingMessage(true)

    try {
      const endpoint = editingMessageId
        ? `/api/communication/scheduled-messages/${editingMessageId}`
        : '/api/communication/scheduled-messages'
      const method = editingMessageId ? 'PATCH' : 'POST'

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...messageForm,
          agendadoPara: toIsoStringInAppTimeZone(messageForm.agendadoPara),
        }),
      })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error ?? 'Nao foi possivel salvar o agendamento')
      }

      setShowMessageModal(false)
      resetMessageForm()
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar agendamento')
    } finally {
      setSavingMessage(false)
    }
  }

  async function handleCancelMessage(id: string) {
    try {
      const res = await fetch(`/api/communication/scheduled-messages/${id}/cancel`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error ?? 'Nao foi possivel cancelar')
      }

      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar mensagem')
    }
  }

  function handleEditMessage(mensagem: MensagemAgendada) {
    setEditingMessageId(mensagem.id)
    setMessageForm({
      clienteId: mensagem.clienteId,
      templateId: mensagem.templateId ?? '',
      conteudoMensagem: mensagem.conteudoMensagem,
      agendadoPara: toDateTimeLocalInputValue(mensagem.agendadoPara),
    })
    setShowMessageModal(true)
  }

  function handleTemplateSelect(templateId: string) {
    const selectedTemplate = templates.find((template) => template.id === templateId)
    setMessageForm((current) => ({
      ...current,
      templateId,
      conteudoMensagem: selectedTemplate?.conteudo ?? current.conteudoMensagem,
    }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comunicacao"
        title="Central de Comunicacao"
        description="O modulo reune o status real do WhatsApp, templates reaproveitaveis e mensagens agendadas para a equipe nao depender do manager da Evolution como interface principal."
        meta={[
          {
            label: status ? statusLabel[status.status] ?? status.status : 'Consultando canal',
            tone: status?.connected ? 'success' : status?.status === 'error' ? 'danger' : 'warning',
          },
          { label: 'Agendamento manual ativo' },
        ]}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowTemplateModal(true)}
              className="btn-secondary"
            >
              Criar template
            </button>
            <button
              type="button"
              onClick={() => {
                resetMessageForm()
                setShowMessageModal(true)
              }}
              className="btn-primary"
            >
              Agendar mensagem
            </button>
          </>
        }
      />

      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricCard
          label="Canal WhatsApp"
          value={status ? statusLabel[status.status] ?? status.status : '...'}
          hint={status?.phoneNumber ? `Numero: ${status.phoneNumber}` : 'Sem numero confirmado ainda.'}
          tone={status?.connected ? 'success' : status?.status === 'error' ? 'danger' : 'warning'}
          icon={<WhatsAppIcon className="h-5 w-5" />}
        />
        <MetricCard
          label="Mensagens para hoje"
          value={scheduledToday}
          hint="Agendamentos previstos no calendario atual."
          tone={scheduledToday > 0 ? 'volve' : 'neutral'}
          icon={<CalendarIcon className="h-5 w-5" />}
        />
        <MetricCard
          label="Templates ativos"
          value={activeTemplates}
          hint="Bases prontas para follow-up e comunicados."
          tone={activeTemplates > 0 ? 'neutral' : 'warning'}
          icon={<SparkIcon className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <section className="space-y-6">
          <div className="card space-y-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <h2 className="section-title">Status do canal WhatsApp</h2>
                <p className="section-copy">
                  O produto agora reflete a verdade do canal. Se a instancia ainda nao esta pronta, a interface deixa isso claro e evita fingir envio automatico.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConnectWhatsApp}
                disabled={connecting}
                className="btn-secondary"
              >
                {connecting ? 'Abrindo conexao...' : 'Conectar WhatsApp'}
              </button>
            </div>

            {qrCode ? (
              <div className="flex flex-col items-center gap-4 rounded-[24px] border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-sm font-semibold text-emerald-900">
                  Escaneie o QR code com o WhatsApp para conectar
                </p>
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="h-56 w-56 rounded-xl border border-emerald-200 bg-white p-2"
                />
                <p className="text-xs text-emerald-700">
                  O QR code expira em 60 segundos. O painel atualiza automaticamente apos a leitura.
                </p>
              </div>
            ) : qrError ? (
              <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {qrError}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Carregando status do canal...
              </div>
            ) : status ? (
              <div className="grid gap-4 md:grid-cols-[1fr,1.1fr]">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Estado atual</p>
                    <span className={statusBadge[status.status] ?? 'badge-gray'}>
                      {statusLabel[status.status] ?? status.status}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <p>Estado bruto da Evolution: {status.rawState}</p>
                    <p>Numero identificado: {status.phoneNumber ?? 'Ainda nao retornado pela API'}</p>
                    <p>
                      Ultima conexao:{' '}
                      {status.lastConnectionAt
                        ? formatDateTimeInAppTimeZone(status.lastConnectionAt)
                        : 'Sem registro'}
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <p className="font-semibold">Honestidade da fase</p>
                  <p className="mt-2">
                    O canal pode ser consultado e acompanhado pela Volve agora. Se a instancia precisar de QR code, a acao de conectar abre o fluxo manual como fallback seguro, em vez de simular um pronto que nao existe.
                  </p>
                  {status.lastError ? <p className="mt-3">Detalhe tecnico: {status.lastError}</p> : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="card space-y-5">
            <div className="space-y-2">
              <h2 className="section-title">Mensagens agendadas</h2>
              <p className="section-copy">{executorNotice}</p>
            </div>

            {loading ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Carregando agendamentos...
              </div>
            ) : mensagens.length === 0 ? (
              <EmptyState
                icon={<CommunicationIcon className="h-6 w-6" />}
                title="Nenhum agendamento criado ainda"
                description="Comece com follow-ups de proposta, lembretes de assinatura ou mensagens operacionais para clientes ativos."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      resetMessageForm()
                      setShowMessageModal(true)
                    }}
                    className="btn-primary"
                  >
                    Agendar primeira mensagem
                  </button>
                }
              />
            ) : (
              <div className="space-y-3">
                {mensagens.map((mensagem) => (
                  <article
                    key={mensagem.id}
                    className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={scheduleBadge[mensagem.status] ?? 'badge-gray'}>
                            {scheduleLabel[mensagem.status] ?? mensagem.status}
                          </span>
                          {mensagem.template?.nome ? (
                            <span className="badge-gray">Template: {mensagem.template.nome}</span>
                          ) : (
                            <span className="badge-gray">Mensagem livre</span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {mensagem.cliente?.nome ?? 'Cliente sem nome'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {mensagem.cliente?.whatsapp
                              ? `WhatsApp: ${mensagem.cliente.whatsapp}`
                              : 'Cliente sem telefone salvo'}
                          </p>
                          <p className="text-sm leading-6 text-slate-600">
                            {mensagem.conteudoMensagem}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 lg:w-[240px]">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          <p className="font-semibold text-slate-800">Agendada para</p>
                          <p className="mt-1">
                            {formatDateTimeInAppTimeZone(mensagem.agendadoPara)}
                          </p>
                          {mensagem.enviadoEm ? (
                            <p className="mt-2 text-xs text-slate-500">
                              Ultima confirmacao: {formatDateTimeInAppTimeZone(mensagem.enviadoEm)}
                            </p>
                          ) : null}
                          {mensagem.externalMessageId ? (
                            <p className="mt-2 break-all text-xs text-slate-500">
                              ID Evolution: {mensagem.externalMessageId}
                            </p>
                          ) : null}
                          {mensagem.mensagemErro ? (
                            <p className="mt-2 text-xs text-rose-600">
                              Falha: {mensagem.mensagemErro}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {mensagem.status === 'scheduled' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEditMessage(mensagem)}
                                className="btn-secondary"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelMessage(mensagem.id)}
                                className="btn-secondary"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="card space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <h2 className="section-title">Templates</h2>
                <p className="section-copy">
                  Modelos simples para reduzir retrabalho da equipe sem cair em automacao prematura.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(true)}
                className="btn-secondary"
              >
                Novo
              </button>
            </div>

            {loading ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Carregando templates...
              </div>
            ) : templates.length === 0 ? (
              <EmptyState
                icon={<SparkIcon className="h-6 w-6" />}
                title="Sem templates por enquanto"
                description="Crie mensagens base para follow-up de proposta, cobranca e lembrete de assinatura."
                action={
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(true)}
                    className="btn-primary"
                  >
                    Criar template
                  </button>
                }
              />
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <article
                    key={template.id}
                    className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{template.nome}</p>
                          <p className="text-xs text-slate-500">
                            {template.categoria ?? 'Sem categoria'}
                          </p>
                        </div>
                        <span className={template.ativo ? 'badge-green' : 'badge-gray'}>
                          {template.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-slate-600">{template.conteudo}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="card space-y-4">
            <div className="space-y-2">
              <h2 className="section-title">Atalhos do fluxo</h2>
              <p className="section-copy">
                O modulo ja se conecta naturalmente com as esteiras mais sensiveis da operacao.
              </p>
            </div>

            <div className="space-y-3">
              <a
                href="/painel/propostas"
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
              >
                Follow-up de propostas
                <ArrowRightIcon className="h-4 w-4" />
              </a>
              <a
                href="/painel/contratos"
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
              >
                Lembretes de assinatura
                <ArrowRightIcon className="h-4 w-4" />
              </a>
              <a
                href="/painel/cobrancas"
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
              >
                Cobrancas e vencimentos
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </div>

      {showTemplateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-[32px] border border-white/70 bg-white p-6 shadow-2xl">
            <div className="mb-5 space-y-2">
              <p className="panel-kicker">Template</p>
              <h2 className="text-2xl font-semibold text-slate-950">Novo template</h2>
              <p className="text-sm text-slate-500">
                Use mensagens enxutas e reutilizaveis para reduzir improviso operacional.
              </p>
            </div>

            <form onSubmit={handleSubmitTemplate} className="space-y-4">
              <div>
                <label className="label">Nome</label>
                <input
                  required
                  className="input"
                  value={templateForm.nome}
                  onChange={(event) =>
                    setTemplateForm((current) => ({ ...current, nome: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Categoria</label>
                <input
                  className="input"
                  placeholder="Ex: Follow-up, Financeiro, Operacao"
                  value={templateForm.categoria}
                  onChange={(event) =>
                    setTemplateForm((current) => ({ ...current, categoria: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Conteudo</label>
                <textarea
                  required
                  rows={6}
                  className="input resize-none"
                  value={templateForm.conteudo}
                  onChange={(event) =>
                    setTemplateForm((current) => ({ ...current, conteudo: event.target.value }))
                  }
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplateModal(false)
                    resetTemplateForm()
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={savingTemplate} className="btn-primary">
                  {savingTemplate ? 'Salvando...' : 'Salvar template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showMessageModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-3xl rounded-[32px] border border-white/70 bg-white p-6 shadow-2xl">
            <div className="mb-5 space-y-2">
              <p className="panel-kicker">Agendamento manual</p>
              <h2 className="text-2xl font-semibold text-slate-950">
                {editingMessageId ? 'Editar mensagem' : 'Nova mensagem agendada'}
              </h2>
              <p className="text-sm text-slate-500">
                O fluxo salva o agendamento, permite editar e cancelar, e deixa claro que o disparo automatico depende da rotina de execucao da infraestrutura.
              </p>
            </div>

            <form onSubmit={handleSubmitMessage} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Cliente</label>
                  <select
                    required
                    className="input"
                    value={messageForm.clienteId}
                    onChange={(event) =>
                      setMessageForm((current) => ({ ...current, clienteId: event.target.value }))
                    }
                  >
                    <option value="">Selecione...</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Template</label>
                  <select
                    className="input"
                    value={messageForm.templateId}
                    onChange={(event) => handleTemplateSelect(event.target.value)}
                  >
                    <option value="">Mensagem livre</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Mensagem</label>
                <textarea
                  required
                  rows={7}
                  className="input resize-none"
                  value={messageForm.conteudoMensagem}
                  onChange={(event) =>
                    setMessageForm((current) => ({
                      ...current,
                      conteudoMensagem: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="label">Agendar para</label>
                <input
                  required
                  type="datetime-local"
                  className="input"
                  value={messageForm.agendadoPara}
                  onChange={(event) =>
                    setMessageForm((current) => ({
                      ...current,
                      agendadoPara: event.target.value,
                    }))
                  }
                />
                <p className="mt-2 text-xs text-slate-500">
                  Horario fixado em {APP_TIME_ZONE}.
                </p>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Esta fase registra, organiza e exibe o agendamento com clareza. O disparo automatico exato por horario ainda depende de uma rotina dedicada de execucao.
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowMessageModal(false)
                    resetMessageForm()
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={savingMessage} className="btn-primary">
                  {savingMessage ? 'Salvando...' : editingMessageId ? 'Atualizar agendamento' : 'Salvar agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function ComunicacaoPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <PageHeader
            eyebrow="Comunicacao"
            title="Central de Comunicacao"
            description="Carregando configuracoes, templates e agendamentos da operacao."
            meta={[{ label: 'Preparando modulo' }]}
          />
          <div className="card px-4 py-10 text-center text-sm text-slate-500">
            Carregando modulo de comunicacao...
          </div>
        </div>
      }
    >
      <ComunicacaoPageContent />
    </Suspense>
  )
}
