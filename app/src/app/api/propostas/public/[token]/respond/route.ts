import type { StatusProposta } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { transitionLeadStage } from '@/lib/leads'
import prisma from '@/lib/prisma'

type Params = { params: { token: string } }

function parsePublicStatus(value: unknown): Extract<StatusProposta, 'aceita' | 'recusada'> | null {
  if (value === 'aceita' || value === 'recusada') return value
  return null
}

export async function POST(request: NextRequest, { params }: Params) {
  let body: Record<string, unknown>

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  const nextStatus = parsePublicStatus(body.status)
  if (!nextStatus) {
    return NextResponse.json(
      { success: false, error: 'Status publico invalido' },
      { status: 400 },
    )
  }

  try {
    const proposta = await prisma.proposta.findUnique({
      where: { token: params.token },
      include: { lead: true },
    })

    if (!proposta) {
      return NextResponse.json(
        { success: false, error: 'Proposta nao encontrada' },
        { status: 404 },
      )
    }

    if (['aceita', 'recusada', 'expirada'].includes(proposta.status)) {
      return NextResponse.json(
        { success: false, error: 'Esta proposta ja foi encerrada' },
        { status: 409 },
      )
    }

    if (proposta.validade) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const validade = new Date(proposta.validade)
      validade.setHours(23, 59, 59, 999)

      if (validade < today) {
        await prisma.proposta.update({
          where: { id: proposta.id },
          data: { status: 'expirada' },
        })

        return NextResponse.json(
          { success: false, error: 'Esta proposta expirou' },
          { status: 410 },
        )
      }
    }

    const feedback = body.feedback ? String(body.feedback).trim() : ''

    const atualizada = await prisma.proposta.update({
      where: { id: proposta.id },
      data: {
        status: nextStatus,
        ...(nextStatus === 'aceita' ? { aceitoEm: new Date() } : {}),
        ...(nextStatus === 'recusada' ? { recusadoEm: new Date() } : {}),
      },
      include: {
        cliente: true,
        lead: true,
      },
    })

    if (proposta.leadId && nextStatus === 'aceita') {
      await transitionLeadStage({
        leadId: proposta.leadId,
        nextStage: 'won',
        proposalId: proposta.id,
        content: 'Lead convertido apos aceite publico da proposta.',
        metadata: {
          propostaToken: proposta.token,
          publicResponse: true,
        },
        force: true,
      })
    }

    if (proposta.leadId && nextStatus === 'recusada') {
      await transitionLeadStage({
        leadId: proposta.leadId,
        nextStage: 'lost',
        proposalId: proposta.id,
        lostReason: feedback || 'Proposta recusada',
        content: `Lead marcado como perdido apos recusa publica da proposta.${feedback ? ` Motivo: ${feedback}` : ''}`,
        metadata: {
          propostaToken: proposta.token,
          publicResponse: true,
        },
        force: true,
      })
    }

    return NextResponse.json({ success: true, data: atualizada })
  } catch (error) {
    console.error('[POST /api/propostas/public/[token]/respond]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao registrar resposta da proposta' },
      { status: 500 },
    )
  }
}
