// =============================================================================
// Tipos globais — Plataforma Volve
// =============================================================================

// ---------------------------------------------------------------------------
// Enums (espelham o schema Prisma)
// ---------------------------------------------------------------------------
export type Perfil = 'equipe' | 'cliente'
export type LeadSource = 'indicacao' | 'instagram' | 'site' | 'outro'
export type LeadStage =
  | 'new'
  | 'contacted'
  | 'meeting'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'
export type LeadTimelineType =
  | 'stage_change'
  | 'wa_sent'
  | 'wa_received'
  | 'note'
  | 'proposal_sent'
  | 'meeting_scheduled'
  | 'converted'
export type FollowUpJobStatus = 'pending' | 'sent' | 'cancelled' | 'failed'

export type StatusEntrega =
  | 'em_producao'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'reprovado'
  | 'entregue'

export type StatusAprovacao = 'aguardando' | 'aprovado' | 'reprovado'

export type StatusProposta =
  | 'rascunho'
  | 'enviada'
  | 'visualizada'
  | 'aceita'
  | 'recusada'
  | 'expirada'

export type StatusContrato = 'pendente' | 'enviado' | 'assinado' | 'cancelado'

// ---------------------------------------------------------------------------
// Entidades principais
// ---------------------------------------------------------------------------
export interface Cliente {
  id: string
  nome: string
  email: string
  whatsapp: string | null
  cpfCnpj: string | null
  asaasId: string | null
  ativo: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Lead {
  id: string
  name: string
  company: string | null
  phone: string
  email: string | null
  instagram: string | null
  source: LeadSource
  referredBy: string | null
  stage: LeadStage
  assignedTo: string | null
  servicesInterest: string[]
  estimatedValue: number | null
  notes: string | null
  nextAction: string | null
  nextActionDate: Date | null
  lostReason: string | null
  convertedAt: Date | null
  clientId: string | null
  stageChangedAt: Date
  createdAt: Date
  updatedAt: Date
  client?: Cliente | null
  assignee?: {
    id: string
    nome: string
    email: string
  } | null
}

export interface LeadTimelineItem {
  id: string
  leadId: string
  type: LeadTimelineType
  content: string | null
  metadata: Record<string, unknown> | null
  createdBy: string | null
  createdAt: Date
}

export interface FollowUpJob {
  id: string
  leadId: string
  type: string
  scheduledAt: Date
  sentAt: Date | null
  cancelledAt: Date | null
  message: string
  metadata: Record<string, unknown> | null
  status: FollowUpJobStatus
  createdAt: Date
}

export interface Servico {
  id: string
  nome: string
  descricao: string | null
  preco: number
  categoria: string | null
  ativo: boolean
  createdAt: Date
}

export interface Entrega {
  id: string
  clienteId: string
  servicoId: string | null
  clickupTaskId: string | null
  titulo: string
  descricao: string | null
  status: StatusEntrega
  arquivoUrl: string | null
  createdAt: Date
  updatedAt: Date
  cliente?: Cliente
  servico?: Servico | null
}

export interface Aprovacao {
  id: string
  entregaId: string
  clienteId: string
  status: StatusAprovacao
  comentario: string | null
  aprovadoEm: Date | null
  createdAt: Date
  entrega?: Entrega
  cliente?: Cliente
}

export interface ItemProposta {
  servicoId?: string
  nome: string
  descricao?: string
  quantidade: number
  valorUnitario: number
}

export interface Proposta {
  id: string
  clienteId: string | null
  leadId: string | null
  titulo: string
  descricao: string | null
  itens: ItemProposta[]
  valorTotal: number
  token: string
  status: StatusProposta
  validade: Date | null
  pdfUrl: string | null
  visualizadoEm: Date | null
  aceitoEm: Date | null
  recusadoEm: Date | null
  createdAt: Date
  updatedAt: Date
  cliente?: Cliente | null
  lead?: Lead | null
}

export interface Contrato {
  id: string
  clienteId: string
  propostaId: string | null
  autentiqueId: string | null
  titulo: string
  conteudo: string | null
  status: StatusContrato
  documentoUrl: string | null
  linkAssinatura: string | null
  assinadoEm: Date | null
  createdAt: Date
  updatedAt: Date
  cliente?: Cliente
  proposta?: Proposta | null
}

export interface Cobranca {
  id: string
  clienteId: string
  contratoId: string | null
  asaasId: string | null
  descricao: string
  valor: number
  vencimento: Date
  tipo: string
  status: string
  linkPagamento: string | null
  invoiceUrl: string | null
  pixCopaCola: string | null
  pagoEm: Date | null
  notificadoEm: Date | null
  createdAt: Date
  updatedAt: Date
  cliente?: Cliente
  contrato?: Contrato | null
}

export type StatusCanalWhatsApp =
  | 'connected'
  | 'disconnected'
  | 'awaiting_qr'
  | 'error'
  | 'unknown'

export type StatusMensagemAgendada =
  | 'scheduled'
  | 'processing'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'canceled'
  | 'failed'

export interface CanalWhatsApp {
  id: string
  provider: string
  instanceName: string
  status: StatusCanalWhatsApp | string
  phoneNumber: string | null
  lastConnectionAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

export interface TemplateMensagem {
  id: string
  nome: string
  categoria: string | null
  stage: string | null
  conteudo: string
  ativo: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MensagemAgendada {
  id: string
  clienteId: string
  canal: string
  templateId: string | null
  conteudoMensagem: string
  agendadoPara: Date
  status: StatusMensagemAgendada | string
  externalMessageId: string | null
  enviadoEm: Date | null
  mensagemErro: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  cliente?: Cliente
  template?: TemplateMensagem | null
}

// ---------------------------------------------------------------------------
// Payloads de API
// ---------------------------------------------------------------------------
export interface CreateClientePayload {
  nome: string
  email: string
  whatsapp?: string
  cpfCnpj?: string
}

export interface CreateServicoPayload {
  nome: string
  descricao?: string
  preco: number
  categoria?: string
}

export interface CreatePropostaPayload {
  clienteId?: string
  leadId?: string
  titulo: string
  descricao?: string
  itens: ItemProposta[]
  validade?: string  // ISO date string
}

export interface CreateLeadPayload {
  name: string
  company?: string
  phone: string
  email?: string
  instagram?: string
  source?: LeadSource
  referredBy?: string
  assignedTo?: string
  servicesInterest?: string[]
  estimatedValue?: number
  notes?: string
  nextAction?: string
  nextActionDate?: string
}

export interface CreateContratoPayload {
  clienteId: string
  propostaId?: string
  titulo: string
  conteudo: string
}

export interface CreateCobrancaPayload {
  clienteId: string
  contratoId?: string
  descricao: string
  valor: number
  vencimento: string  // ISO date string
  tipo?: 'BOLETO' | 'PIX' | 'CREDIT_CARD'
}

export interface CreateTemplateMensagemPayload {
  nome: string
  categoria?: string
  conteudo: string
}

export interface CreateMensagemAgendadaPayload {
  clienteId: string
  templateId?: string
  conteudoMensagem: string
  agendadoPara: string
}

// ---------------------------------------------------------------------------
// Resposta padrão de API
// ---------------------------------------------------------------------------
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ---------------------------------------------------------------------------
// Webhook payloads
// ---------------------------------------------------------------------------
export interface ClickUpWebhookPayload {
  event: string
  task_id: string
  history_items?: Array<{
    field: string
    before: { status: string }
    after: { status: string }
  }>
  webhook_id: string
}

export interface AsaasWebhookPayload {
  event: string
  payment: {
    id: string
    customer: string
    value: number
    netValue: number
    status: string
    dueDate: string
    paymentDate?: string
    billingType: string
    invoiceUrl?: string
    bankSlipUrl?: string
    pixQrCodeId?: string
    encodedImage?: string   // QR code base64
    payload?: string        // PIX copia e cola
  }
}

export interface AutentiqueWebhookPayload {
  event: string
  document: {
    id: string
    name: string
    status: string
    signers: Array<{
      email: string
      signed_at: string | null
    }>
    files?: {
      signed?: string
    }
  }
}

// ---------------------------------------------------------------------------
// NextAuth session extensions
// ---------------------------------------------------------------------------
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      nome: string
      email: string
      perfil: Perfil
      clienteId?: string
    }
  }

  interface User {
    id: string
    nome: string
    email: string
    perfil: Perfil
    clienteId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    nome: string
    perfil: Perfil
    clienteId?: string
  }
}
