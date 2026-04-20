import { addDays, subDays } from 'date-fns'
import { Prisma } from '@prisma/client'
import type { LeadSource, LeadStage } from '@/types'
import { createOrFindCustomer } from '@/lib/asaas'
import prisma from '@/lib/prisma'
import { formatDateTimeInAppTimeZone } from '@/lib/timezone'

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  indicacao: 'Indicacao',
  instagram: 'Instagram',
  site: 'Site',
  outro: 'Outro',
}

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: 'Novo lead',
  contacted: 'Primeiro contato',
  meeting: 'Reuniao agendada',
  proposal: 'Proposta enviada',
  negotiation: 'Negociacao',
  won: 'Fechado ganho',
  lost: 'Fechado perdido',
}

const LEAD_STAGE_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  new: ['contacted', 'meeting', 'proposal', 'lost'],
  contacted: ['meeting', 'proposal', 'lost'],
  meeting: ['proposal', 'lost'],
  proposal: ['negotiation', 'won', 'lost'],
  negotiation: ['proposal', 'won', 'lost'],
  won: [],
  lost: [],
}

export const PROPOSAL_AUTO_LOST_REASON = 'Sem resposta apos cadencia'

export class LeadStageTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LeadStageTransitionError'
  }
}

export function normalizeLeadPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')

  if (!digits) return ''
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.length === 12 && digits.startsWith('0')) return `55${digits.slice(1)}`

  return digits
}

export function canMoveLeadStage(currentStage: LeadStage, nextStage: LeadStage) {
  if (currentStage === nextStage) return true
  if (currentStage === 'won') return false
  if (nextStage === 'lost') return true

  return LEAD_STAGE_TRANSITIONS[currentStage].includes(nextStage)
}

export function interpolateTemplate(
  template: string,
  values: Record<string, string | number | null | undefined>,
) {
  const missing = new Set<string>()
  const content = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = values[key]

    if (value === null || value === undefined || value === '') {
      missing.add(key)
      return `{{${key}}}`
    }

    return String(value)
  })

  return {
    content,
    missing: [...missing],
  }
}

export async function createLeadTimelineEntry(params: {
  leadId: string
  type: 'stage_change' | 'wa_sent' | 'wa_received' | 'note' | 'proposal_sent' | 'meeting_scheduled' | 'converted'
  content?: string | null
  metadata?: Record<string, unknown> | null
  createdBy?: string | null
}) {
  const { leadId, type, content, metadata, createdBy } = params

  return prisma.leadTimeline.create({
    data: {
      leadId,
      type,
      content: content ?? null,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      createdBy: createdBy ?? null,
    },
  })
}

export async function cancelPendingFollowUpJobs(leadId: string) {
  return prisma.followUpJob.updateMany({
    where: {
      leadId,
      status: 'pending',
      cancelledAt: null,
    },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
    },
  })
}

function buildProposalFollowUpMessages(leadName: string, proposalLink: string) {
  return [
    {
      type: 'proposal_followup_d3',
      delayDays: 3,
      message: `Oi ${leadName}, tudo bem? Queria saber se teve a chance de ver a proposta. Posso esclarecer alguma duvida ou ajustar algo?`,
    },
    {
      type: 'proposal_followup_d7',
      delayDays: 7,
      message: `Ola ${leadName}! Sei que a semana e corrida. A proposta fica disponivel quando voce quiser revisitar: ${proposalLink}. Ha algo que posso ajustar?`,
    },
    {
      type: 'proposal_followup_d14',
      delayDays: 14,
      message: `Oi ${leadName}, faco esse ultimo contato para nao ser invasivo. Se o momento nao e agora, tudo bem. Estaremos aqui quando fizer sentido.`,
    },
    {
      type: 'proposal_auto_lost_d30',
      delayDays: 30,
      message: PROPOSAL_AUTO_LOST_REASON,
      metadata: { lostReason: PROPOSAL_AUTO_LOST_REASON },
    },
  ]
}

export async function scheduleProposalCadence(params: {
  leadId: string
  leadName: string
  proposalLink: string
  referenceDate?: Date
}) {
  const referenceDate = params.referenceDate ?? new Date()
  const jobs = buildProposalFollowUpMessages(params.leadName, params.proposalLink)

  await cancelPendingFollowUpJobs(params.leadId)

  await prisma.followUpJob.createMany({
    data: jobs.map((job) => ({
      leadId: params.leadId,
      type: job.type,
      scheduledAt: addDays(referenceDate, job.delayDays),
      message: job.message,
      metadata: job.metadata ?? { proposalLink: params.proposalLink },
      status: 'pending',
    })),
  })
}

export async function scheduleMeetingReminder(params: {
  leadId: string
  leadName: string
  nextActionDate: Date
}) {
  const scheduledAt = subDays(params.nextActionDate, 1)

  if (scheduledAt <= new Date()) {
    return null
  }

  await prisma.followUpJob.create({
    data: {
      leadId: params.leadId,
      type: 'meeting_reminder',
      scheduledAt,
      message: `Oi ${params.leadName}! So passando para lembrar que nossa conversa e ${formatDateTimeInAppTimeZone(params.nextActionDate)}. Qualquer imprevisto, e so me avisar!`,
      status: 'pending',
      metadata: {
        nextActionDate: params.nextActionDate.toISOString(),
      },
    },
  })

  return scheduledAt
}

function buildClientEmail(name: string, leadEmail: string | null, leadPhone: string) {
  if (leadEmail?.trim()) {
    return leadEmail.trim().toLowerCase()
  }

  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return `${slug || 'lead'}-${leadPhone}@crm.volvemkt.local`
}

export async function ensureClientFromLead(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      client: true,
    },
  })

  if (!lead) {
    throw new Error('Lead nao encontrado')
  }

  if (lead.client) {
    return lead.client
  }

  const normalizedPhone = normalizeLeadPhone(lead.phone)
  const email = buildClientEmail(lead.name, lead.email, normalizedPhone)

  const existingClient = await prisma.cliente.findFirst({
    where: {
      OR: [
        { email },
        ...(normalizedPhone ? [{ whatsapp: normalizedPhone }] : []),
      ],
    },
  })

  let asaasId: string | null = existingClient?.asaasId ?? null

  if (!existingClient && (lead.email || normalizedPhone)) {
    try {
      const asaasCustomer = await createOrFindCustomer({
        nome: lead.name,
        email,
        whatsapp: normalizedPhone,
      })
      asaasId = asaasCustomer.id
    } catch (error) {
      console.warn('[Lead->Cliente] Falha ao sincronizar cliente no Asaas:', error)
    }
  }

  const client =
    existingClient ??
    (await prisma.cliente.create({
      data: {
        nome: lead.name,
        email,
        whatsapp: normalizedPhone || null,
        asaasId,
      },
    }))

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: lead.id },
      data: {
        clientId: client.id,
        convertedAt: lead.convertedAt ?? new Date(),
      },
    }),
    prisma.proposta.updateMany({
      where: {
        leadId: lead.id,
        clienteId: null,
      },
      data: {
        clienteId: client.id,
      },
    }),
  ])

  return client
}

export async function transitionLeadStage(params: {
  leadId: string
  nextStage: LeadStage
  createdBy?: string | null
  content?: string | null
  lostReason?: string | null
  nextAction?: string | null
  nextActionDate?: Date | null
  proposalLink?: string | null
  proposalId?: string | null
  metadata?: Record<string, unknown> | null
  force?: boolean
}) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    include: {
      assignee: {
        select: { id: true, nome: true, email: true },
      },
      client: true,
    },
  })

  if (!lead) {
    throw new Error('Lead nao encontrado')
  }

  if (!params.force && !canMoveLeadStage(lead.stage as LeadStage, params.nextStage)) {
    throw new LeadStageTransitionError(
      `Transicao invalida: ${lead.stage} -> ${params.nextStage}`,
    )
  }

  const now = new Date()

  if (lead.stage !== params.nextStage || params.nextStage === 'proposal' || params.nextStage === 'meeting') {
    await cancelPendingFollowUpJobs(lead.id)
  }

  let clientId = lead.clientId

  if (params.nextStage === 'won' && !clientId) {
    const client = await ensureClientFromLead(lead.id)
    clientId = client.id
  }

  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stage: params.nextStage,
      stageChangedAt: now,
      lostReason:
        params.nextStage === 'lost'
          ? params.lostReason ?? lead.lostReason ?? null
          : params.lostReason !== undefined
            ? params.lostReason
            : lead.lostReason,
      nextAction:
        params.nextAction !== undefined
          ? params.nextAction
          : params.nextStage === 'won' || params.nextStage === 'lost'
            ? null
            : lead.nextAction,
      nextActionDate:
        params.nextActionDate !== undefined
          ? params.nextActionDate
          : params.nextStage === 'won' || params.nextStage === 'lost'
            ? null
            : lead.nextActionDate,
      clientId,
      convertedAt:
        params.nextStage === 'won'
          ? lead.convertedAt ?? now
          : lead.convertedAt,
    },
    include: {
      assignee: {
        select: { id: true, nome: true, email: true },
      },
      client: true,
    },
  })

  if (params.nextStage === 'proposal' && params.proposalLink) {
    await scheduleProposalCadence({
      leadId: lead.id,
      leadName: lead.name,
      proposalLink: params.proposalLink,
      referenceDate: now,
    })
  }

  if (params.nextStage === 'meeting' && params.nextActionDate) {
    await scheduleMeetingReminder({
      leadId: lead.id,
      leadName: lead.name,
      nextActionDate: params.nextActionDate,
    })
  }

  await createLeadTimelineEntry({
    leadId: lead.id,
    type:
      params.nextStage === 'won'
        ? 'converted'
        : params.nextStage === 'proposal'
          ? 'proposal_sent'
          : params.nextStage === 'meeting' && params.nextActionDate
            ? 'meeting_scheduled'
            : 'stage_change',
    content:
      params.content ??
      `${LEAD_STAGE_LABELS[lead.stage as LeadStage]} -> ${LEAD_STAGE_LABELS[params.nextStage]}`,
    metadata: {
      previousStage: lead.stage,
      nextStage: params.nextStage,
      proposalId: params.proposalId ?? null,
      proposalLink: params.proposalLink ?? null,
      nextAction: params.nextAction ?? null,
      nextActionDate: params.nextActionDate?.toISOString() ?? null,
      ...(params.metadata ?? {}),
    },
    createdBy: params.createdBy ?? null,
  })

  return updatedLead
}

export async function registerLeadIncomingMessage(params: {
  phone: string
  content?: string | null
  metadata?: Record<string, unknown> | null
}) {
  const normalizedPhone = normalizeLeadPhone(params.phone)
  if (!normalizedPhone) return null

  const lead = await prisma.lead.findFirst({
    where: {
      phone: normalizedPhone,
      stage: {
        in: ['new', 'contacted', 'meeting', 'proposal', 'negotiation'],
      },
    },
    orderBy: [{ stageChangedAt: 'desc' }, { createdAt: 'desc' }],
  })

  if (!lead) {
    return null
  }

  await cancelPendingFollowUpJobs(lead.id)

  await createLeadTimelineEntry({
    leadId: lead.id,
    type: 'wa_received',
    content: params.content ?? 'Lead respondeu no WhatsApp',
    metadata: params.metadata ?? undefined,
  })

  return lead
}
