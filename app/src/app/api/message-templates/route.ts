import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const stage = searchParams.get('stage')?.trim() ?? ''

  try {
    const templates = await prisma.templateMensagem.findMany({
      where: stage ? { stage } : undefined,
      orderBy: [{ stage: 'asc' }, { nome: 'asc' }],
    })

    return NextResponse.json({ success: true, data: templates })
  } catch (error) {
    console.error('[GET /api/message-templates]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao listar templates de mensagem' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  let body: { name?: string; body?: string; stage?: string; category?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  const name = body.name?.trim()
  const content = body.body?.trim()

  if (!name || !content) {
    return NextResponse.json(
      { success: false, error: 'Nome e corpo do template sao obrigatorios' },
      { status: 400 },
    )
  }

  try {
    const template = await prisma.templateMensagem.create({
      data: {
        nome: name,
        categoria: body.category?.trim() || 'crm',
        stage: body.stage?.trim() || null,
        conteudo: content,
      },
    })

    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/message-templates]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar template de mensagem' },
      { status: 500 },
    )
  }
}
