import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { parseDateTimeInAppTimeZone } from '@/lib/timezone'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  let body: {
    clienteId?: string
    templateId?: string | null
    conteudoMensagem?: string
    agendadoPara?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  try {
    const existente = await prisma.mensagemAgendada.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    })

    if (!existente) {
      return NextResponse.json({ success: false, error: 'Agendamento nao encontrado' }, { status: 404 })
    }

    if (existente.status !== 'scheduled') {
      return NextResponse.json(
        { success: false, error: 'Somente mensagens agendadas podem ser editadas' },
        { status: 409 },
      )
    }

    const updateData: {
      clienteId?: string
      templateId?: string | null
      conteudoMensagem?: string
      agendadoPara?: Date
    } = {}

    if (body.clienteId) updateData.clienteId = body.clienteId
    if (body.templateId !== undefined) updateData.templateId = body.templateId || null
    if (body.conteudoMensagem?.trim()) updateData.conteudoMensagem = body.conteudoMensagem.trim()

    if (body.agendadoPara) {
      const agendadoPara = parseDateTimeInAppTimeZone(body.agendadoPara)
      if (!agendadoPara) {
        return NextResponse.json(
          { success: false, error: 'Data de agendamento invalida' },
          { status: 400 },
        )
      }
      updateData.agendadoPara = agendadoPara
    }

    const atualizado = await prisma.mensagemAgendada.update({
      where: { id: params.id },
      data: updateData,
      include: {
        cliente: {
          select: { id: true, nome: true, email: true, whatsapp: true },
        },
        template: {
          select: { id: true, nome: true, categoria: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: atualizado })
  } catch (err) {
    console.error('[PATCH /api/communication/scheduled-messages/[id]]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar agendamento' },
      { status: 500 },
    )
  }
}
