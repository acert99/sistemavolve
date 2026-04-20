import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createLeadTimelineEntry, interpolateTemplate } from '@/lib/leads'
import prisma from '@/lib/prisma'
import { formatDateTimeInAppTimeZone, parseDateTimeInAppTimeZone } from '@/lib/timezone'
import { sendTextMessage } from '@/lib/whatsapp'

type Params = { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  let body: {
    templateId?: string
    message?: string
    scheduledAt?: string
    variables?: Record<string, unknown>
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
      include: {
        propostas: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead nao encontrado' },
        { status: 404 },
      )
    }

    let templateBody = body.message?.trim() ?? ''
    let templateName = 'Mensagem manual'

    if (body.templateId) {
      const template = await prisma.templateMensagem.findUnique({
        where: { id: body.templateId },
      })

      if (!template) {
        return NextResponse.json(
          { success: false, error: 'Template nao encontrado' },
          { status: 404 },
        )
      }

      templateBody = template.conteudo
      templateName = template.nome
    }

    if (!templateBody) {
      return NextResponse.json(
        { success: false, error: 'Mensagem nao informada' },
        { status: 400 },
      )
    }

    const latestProposal = lead.propostas[0]
    const proposalLink = latestProposal
      ? `${process.env.NEXT_PUBLIC_VPS_API_URL}/propostas/${latestProposal.token}`
      : ''

    const context = {
      nome: lead.name,
      empresa: lead.company ?? '',
      quem_indicou: lead.referredBy ?? '',
      instagram: lead.instagram ?? '',
      link_proposta: proposalLink,
      dia_hora: lead.nextActionDate ? formatDateTimeInAppTimeZone(lead.nextActionDate) : '',
      ...(body.variables ?? {}),
    }

    const interpolated = interpolateTemplate(templateBody, context)
    if (interpolated.missing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Variaveis faltando: ${interpolated.missing.join(', ')}`,
        },
        { status: 400 },
      )
    }

    const scheduledAt = body.scheduledAt
      ? parseDateTimeInAppTimeZone(body.scheduledAt)
      : null

    if (body.scheduledAt && !scheduledAt) {
      return NextResponse.json(
        { success: false, error: 'Data de agendamento invalida' },
        { status: 400 },
      )
    }

    if (scheduledAt && scheduledAt > new Date()) {
      const job = await prisma.followUpJob.create({
        data: {
          leadId: lead.id,
          type: 'manual_message',
          scheduledAt,
          message: interpolated.content,
          status: 'pending',
          metadata: {
            templateId: body.templateId ?? null,
            templateName,
            scheduledBy: session.user.id,
          },
        },
      })

      await createLeadTimelineEntry({
        leadId: lead.id,
        type: 'note',
        content: `Mensagem agendada: ${templateName}`,
        metadata: {
          followUpJobId: job.id,
          scheduledAt: scheduledAt.toISOString(),
        },
        createdBy: session.user.id,
      })

      return NextResponse.json({ success: true, data: job }, { status: 201 })
    }

    const result = await sendTextMessage(lead.phone, interpolated.content)
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Falha ao enviar mensagem' },
        { status: 502 },
      )
    }

    await createLeadTimelineEntry({
      leadId: lead.id,
      type: 'wa_sent',
      content: interpolated.content,
      metadata: {
        templateId: body.templateId ?? null,
        templateName,
        providerMessageId: result.messageId,
        providerStatus: result.providerStatus,
      },
      createdBy: session.user.id,
    })

    return NextResponse.json({
      success: true,
      data: {
        messageId: result.messageId,
        providerStatus: result.providerStatus,
      },
    })
  } catch (error) {
    console.error('[POST /api/leads/[id]/messages]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao enviar mensagem para o lead' },
      { status: 500 },
    )
  }
}
