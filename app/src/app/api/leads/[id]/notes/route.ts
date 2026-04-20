import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createLeadTimelineEntry } from '@/lib/leads'
import prisma from '@/lib/prisma'

type Params = { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  let body: { content?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  const content = body.content?.trim()
  if (!content) {
    return NextResponse.json(
      { success: false, error: 'Conteudo da anotacao e obrigatorio' },
      { status: 400 },
    )
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead nao encontrado' },
        { status: 404 },
      )
    }

    const note = await createLeadTimelineEntry({
      leadId: lead.id,
      type: 'note',
      content,
      createdBy: session.user.id,
    })

    return NextResponse.json({ success: true, data: note }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/leads/[id]/notes]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao salvar anotacao' },
      { status: 500 },
    )
  }
}
