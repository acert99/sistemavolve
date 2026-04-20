import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  createLeadTimelineEntry,
  LeadStageTransitionError,
  PROPOSAL_AUTO_LOST_REASON,
  transitionLeadStage,
} from '@/lib/leads'
import prisma from '@/lib/prisma'
import { parseDateTimeInAppTimeZone } from '@/lib/timezone'
import { sendTextMessage } from '@/lib/whatsapp'
import type { LeadStage } from '@/types'

type Params = { params: { id: string } }

function parseStage(value: unknown): LeadStage | undefined {
  const raw = String(value ?? '')

  if (
    raw === 'new' ||
    raw === 'contacted' ||
    raw === 'meeting' ||
    raw === 'proposal' ||
    raw === 'negotiation' ||
    raw === 'won' ||
    raw === 'lost'
  ) {
    return raw
  }

  return undefined
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  const nextStage = parseStage(body.stage)
  if (!nextStage) {
    return NextResponse.json(
      { success: false, error: 'Etapa invalida' },
      { status: 400 },
    )
  }

  const nextActionDate =
    body.nextActionDate === undefined
      ? undefined
      : body.nextActionDate
        ? parseDateTimeInAppTimeZone(String(body.nextActionDate))
        : null

  if (body.nextActionDate && !nextActionDate) {
    return NextResponse.json(
      { success: false, error: 'Data da proxima acao invalida' },
      { status: 400 },
    )
  }

  if (nextStage === 'meeting' && !nextActionDate) {
    return NextResponse.json(
      { success: false, error: 'Reuniao precisa de data e hora' },
      { status: 400 },
    )
  }

  try {
    let proposalLink = body.proposalLink ? String(body.proposalLink) : null
    const proposalId = body.proposalId ? String(body.proposalId) : null

    if (!proposalLink && proposalId) {
      const proposal = await prisma.proposta.findUnique({
        where: { id: proposalId },
        select: { token: true },
      })

      if (proposal) {
        proposalLink = `${process.env.NEXT_PUBLIC_VPS_API_URL}/propostas/${proposal.token}`
      }
    }

    const lead = await transitionLeadStage({
      leadId: params.id,
      nextStage,
      createdBy: session.user.id,
      content: body.content ? String(body.content) : null,
      lostReason:
        nextStage === 'lost'
          ? body.lostReason
            ? String(body.lostReason)
            : PROPOSAL_AUTO_LOST_REASON
          : body.lostReason !== undefined
            ? String(body.lostReason)
            : undefined,
      nextAction: body.nextAction !== undefined ? (body.nextAction ? String(body.nextAction) : null) : undefined,
      nextActionDate,
      proposalLink,
      proposalId,
      metadata: body.metadata && typeof body.metadata === 'object'
        ? (body.metadata as Record<string, unknown>)
        : null,
    })

    if (nextStage === 'won' && lead.phone) {
      await sendTextMessage(
        lead.phone,
        `Seja bem-vindo a Volve, ${lead.name}! Estamos muito animados em comecar esse trabalho juntos. Em breve entraremos em contato para alinhar os proximos passos.`,
      )

      await createLeadTimelineEntry({
        leadId: lead.id,
        type: 'wa_sent',
        content: 'Mensagem de boas-vindas enviada automaticamente.',
        metadata: { stage: 'won', automatic: true },
        createdBy: session.user.id,
      })
    }

    return NextResponse.json({ success: true, data: lead })
  } catch (error) {
    if (error instanceof LeadStageTransitionError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 },
      )
    }

    console.error('[PUT /api/leads/[id]/stage]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao mover lead de etapa' },
      { status: 500 },
    )
  }
}
