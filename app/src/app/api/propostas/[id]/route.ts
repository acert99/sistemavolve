import type { Prisma, StatusProposta } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createLeadTimelineEntry, transitionLeadStage } from '@/lib/leads'
import prisma from '@/lib/prisma'
import { parseDateOnlyInAppTimeZone } from '@/lib/timezone'
import { notificarProposta } from '@/lib/whatsapp'

type Params = { params: { id: string } }

function parseStatus(value: unknown): StatusProposta | undefined {
  const raw = String(value ?? '')

  if (
    raw === 'rascunho' ||
    raw === 'enviada' ||
    raw === 'visualizada' ||
    raw === 'aceita' ||
    raw === 'recusada' ||
    raw === 'expirada'
  ) {
    return raw
  }

  return undefined
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  try {
    const proposta = await prisma.proposta.findUnique({
      where: { id: params.id },
      include: { cliente: true, lead: true },
    })

    if (!proposta) {
      return NextResponse.json(
        { success: false, error: 'Proposta nao encontrada' },
        { status: 404 },
      )
    }

    if (session.user.perfil === 'cliente' && proposta.clienteId !== session.user.clienteId) {
      return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: proposta })
  } catch (err) {
    console.error('[GET /api/propostas/[id]]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar proposta' },
      { status: 500 },
    )
  }
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

  const { action, ...updateData } = body

  try {
    if (action === 'enviar') {
      const proposta = await prisma.proposta.findUnique({
        where: { id: params.id },
        include: { cliente: true, lead: true },
      })

      if (!proposta) {
        return NextResponse.json(
          { success: false, error: 'Proposta nao encontrada' },
          { status: 404 },
        )
      }

      const linkProposta = `${process.env.NEXT_PUBLIC_VPS_API_URL}/propostas/${proposta.token}`
      const targetName = proposta.cliente?.nome ?? proposta.lead?.name ?? 'Contato'
      const targetPhone = proposta.cliente?.whatsapp ?? proposta.lead?.phone ?? null

      if (targetPhone) {
        await notificarProposta({
          phone: targetPhone,
          clienteNome: targetName,
          tituloProposta: proposta.titulo,
          valorTotal: Number(proposta.valorTotal),
          linkProposta,
        })
      }

      const atualizada = await prisma.proposta.update({
        where: { id: params.id },
        data: { status: 'enviada' },
      })

      if (proposta.leadId) {
        await transitionLeadStage({
          leadId: proposta.leadId,
          nextStage: 'proposal',
          proposalId: proposta.id,
          proposalLink: linkProposta,
          content: 'Proposta enviada ao lead.',
        })

        await createLeadTimelineEntry({
          leadId: proposta.leadId,
          type: 'wa_sent',
          content: `Proposta enviada por WhatsApp: ${proposta.titulo}`,
          metadata: {
            propostaId: proposta.id,
            propostaToken: proposta.token,
          },
        })
      }

      return NextResponse.json({ success: true, data: atualizada })
    }

    const nextStatus = parseStatus(updateData.status)
    const data: Prisma.PropostaUpdateInput = {
      ...(updateData.titulo ? { titulo: String(updateData.titulo).trim() } : {}),
      ...(updateData.descricao !== undefined
        ? { descricao: updateData.descricao ? String(updateData.descricao).trim() : null }
        : {}),
      ...(updateData.itens ? { itens: updateData.itens as Prisma.InputJsonValue } : {}),
      ...(updateData.valorTotal !== undefined
        ? { valorTotal: Number(updateData.valorTotal) }
        : {}),
      ...(updateData.validade !== undefined
        ? {
            validade: updateData.validade
              ? parseDateOnlyInAppTimeZone(String(updateData.validade))
              : null,
          }
        : {}),
      ...(nextStatus ? {
        status: nextStatus,
        ...(nextStatus === 'aceita' ? { aceitoEm: new Date() } : {}),
        ...(nextStatus === 'recusada' ? { recusadoEm: new Date() } : {}),
      } : {}),
    }

    const proposta = await prisma.proposta.update({
      where: { id: params.id },
      data,
      include: {
        lead: true,
      },
    })

    if (proposta.leadId && nextStatus === 'aceita') {
      await transitionLeadStage({
        leadId: proposta.leadId,
        nextStage: 'won',
        proposalId: proposta.id,
        content: 'Lead convertido apos aceite da proposta.',
      })
    }

    if (proposta.leadId && nextStatus === 'recusada') {
      await transitionLeadStage({
        leadId: proposta.leadId,
        nextStage: 'lost',
        proposalId: proposta.id,
        lostReason: updateData.feedback ? String(updateData.feedback) : 'Proposta recusada',
        content: 'Lead marcado como perdido apos recusa da proposta.',
      })
    }

    return NextResponse.json({ success: true, data: proposta })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Proposta nao encontrada' },
        { status: 404 },
      )
    }

    console.error('[PUT /api/propostas/[id]]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar proposta' },
      { status: 500 },
    )
  }
}
