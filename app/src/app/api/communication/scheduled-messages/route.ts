import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { parseDateTimeInAppTimeZone } from '@/lib/timezone'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  try {
    const mensagens = await prisma.mensagemAgendada.findMany({
      where: status ? { status } : undefined,
      include: {
        cliente: {
          select: { id: true, nome: true, email: true, whatsapp: true },
        },
        template: {
          select: { id: true, nome: true, categoria: true },
        },
      },
      orderBy: [{ agendadoPara: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    })

    return NextResponse.json({
      success: true,
      data: mensagens,
      meta: {
        total: mensagens.length,
        executorConfigured: Boolean(process.env.CRON_SECRET),
      },
    })
  } catch (err) {
    console.error('[GET /api/communication/scheduled-messages]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao listar mensagens agendadas' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  let body: {
    clienteId?: string
    templateId?: string
    conteudoMensagem?: string
    agendadoPara?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  const agendadoPara = parseDateTimeInAppTimeZone(body.agendadoPara)
  const conteudoMensagem = body.conteudoMensagem?.trim()

  if (!body.clienteId || !conteudoMensagem || !agendadoPara) {
    return NextResponse.json(
      { success: false, error: 'Cliente, conteudo e data sao obrigatorios' },
      { status: 400 },
    )
  }

  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: body.clienteId },
      select: { id: true },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente nao encontrado' },
        { status: 404 },
      )
    }

    if (body.templateId) {
      const template = await prisma.templateMensagem.findUnique({
        where: { id: body.templateId },
        select: { id: true },
      })

      if (!template) {
        return NextResponse.json(
          { success: false, error: 'Template nao encontrado' },
          { status: 404 },
        )
      }
    }

    const mensagem = await prisma.mensagemAgendada.create({
      data: {
        clienteId: body.clienteId,
        templateId: body.templateId || null,
        conteudoMensagem,
        agendadoPara,
        createdBy: session.user.id,
      },
      include: {
        cliente: {
          select: { id: true, nome: true, email: true, whatsapp: true },
        },
        template: {
          select: { id: true, nome: true, categoria: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: mensagem }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/communication/scheduled-messages]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar agendamento' },
      { status: 500 },
    )
  }
}
