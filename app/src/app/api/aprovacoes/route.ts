// =============================================================================
// API — Aprovações
// GET  /api/aprovacoes  → lista aprovações (equipe: todas; cliente: suas)
// POST /api/aprovacoes  → responde à aprovação (aprovar ou reprovar)
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { updateTaskStatus, addTaskComment } from '@/lib/clickup'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const page   = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit  = Math.min(50, Number(searchParams.get('limit') ?? '20'))

  try {
    const where = {
      // Clientes só veem suas próprias aprovações
      ...(session.user.perfil === 'cliente'
        ? { clienteId: session.user.clienteId }
        : {}),
      ...(status ? { status } : {}),
    }

    const [aprovacoes, total] = await Promise.all([
      prisma.aprovacao.findMany({
        where,
        include: {
          entrega: {
            include: { servico: true },
          },
          cliente: {
            select: { id: true, nome: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.aprovacao.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: aprovacoes,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[GET /api/aprovacoes]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar aprovações' },
      { status: 500 },
    )
  }
}

// POST → cliente responde: { aprovacaoId, status: 'aprovado'|'reprovado', comentario? }
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  let body: {
    aprovacaoId: string
    status: 'aprovado' | 'reprovado'
    comentario?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { aprovacaoId, status, comentario } = body

  if (!aprovacaoId || !['aprovado', 'reprovado'].includes(status)) {
    return NextResponse.json(
      { success: false, error: 'Dados inválidos' },
      { status: 400 },
    )
  }

  try {
    // Verifica se a aprovação existe e pertence ao cliente
    const aprovacao = await prisma.aprovacao.findUnique({
      where: { id: aprovacaoId },
      include: { entrega: true },
    })

    if (!aprovacao) {
      return NextResponse.json(
        { success: false, error: 'Aprovação não encontrada' },
        { status: 404 },
      )
    }

    // Cliente só pode responder suas próprias aprovações
    if (
      session.user.perfil === 'cliente' &&
      aprovacao.clienteId !== session.user.clienteId
    ) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 403 })
    }

    if (aprovacao.status !== 'aguardando') {
      return NextResponse.json(
        { success: false, error: 'Esta aprovação já foi respondida' },
        { status: 409 },
      )
    }

    // Atualiza aprovação no banco
    const aprovacaoAtualizada = await prisma.aprovacao.update({
      where: { id: aprovacaoId },
      data: {
        status,
        comentario: comentario?.trim() ?? null,
        aprovadoEm: new Date(),
      },
    })

    // Atualiza status da entrega
    const novoStatusEntrega = status === 'aprovado' ? 'aprovado' : 'reprovado'
    await prisma.entrega.update({
      where: { id: aprovacao.entregaId },
      data: { status: novoStatusEntrega },
    })

    // Sincroniza com ClickUp (se tiver task vinculada)
    if (aprovacao.entrega.clickupTaskId) {
      const clickupStatus = status === 'aprovado' ? 'aprovado' : 'reprovado'
      try {
        await updateTaskStatus(aprovacao.entrega.clickupTaskId, clickupStatus)

        if (comentario) {
          const user =
            session.user.perfil === 'cliente'
              ? 'Cliente'
              : session.user.nome
          await addTaskComment(
            aprovacao.entrega.clickupTaskId,
            `[${status.toUpperCase()}] por ${user}: ${comentario}`,
          )
        }
      } catch (clickupErr) {
        console.warn('[POST /api/aprovacoes] ClickUp sync falhou:', clickupErr)
      }
    }

    return NextResponse.json({ success: true, data: aprovacaoAtualizada })
  } catch (err) {
    console.error('[POST /api/aprovacoes]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao registrar aprovação' },
      { status: 500 },
    )
  }
}
