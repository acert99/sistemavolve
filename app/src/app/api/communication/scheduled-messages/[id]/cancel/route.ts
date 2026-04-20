import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  try {
    const existente = await prisma.mensagemAgendada.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    })

    if (!existente) {
      return NextResponse.json({ success: false, error: 'Agendamento nao encontrado' }, { status: 404 })
    }

    if (existente.status === 'sent') {
      return NextResponse.json(
        { success: false, error: 'Mensagens ja enviadas nao podem ser canceladas' },
        { status: 409 },
      )
    }

    const mensagem = await prisma.mensagemAgendada.update({
      where: { id: params.id },
      data: { status: 'canceled' },
    })

    return NextResponse.json({ success: true, data: mensagem })
  } catch (err) {
    console.error('[POST /api/communication/scheduled-messages/[id]/cancel]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao cancelar agendamento' },
      { status: 500 },
    )
  }
}
