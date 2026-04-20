import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  try {
    const templates = await prisma.templateMensagem.findMany({
      orderBy: [{ ativo: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ success: true, data: templates })
  } catch (err) {
    console.error('[GET /api/communication/templates]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao listar templates' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  let body: { nome?: string; categoria?: string; conteudo?: string; stage?: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  const nome = body.nome?.trim()
  const conteudo = body.conteudo?.trim()

  if (!nome || !conteudo) {
    return NextResponse.json(
      { success: false, error: 'Nome e conteudo sao obrigatorios' },
      { status: 400 },
    )
  }

  try {
    const template = await prisma.templateMensagem.create({
      data: {
        nome,
        categoria: body.categoria?.trim() || null,
        stage: body.stage?.trim() || null,
        conteudo,
      },
    })

    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/communication/templates]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar template' },
      { status: 500 },
    )
  }
}
