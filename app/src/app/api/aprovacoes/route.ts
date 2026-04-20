import type { Prisma, StatusAprovacao } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { addTaskComment, updateTaskStatus } from '@/lib/clickup'

function parseStatus(value: string | null): StatusAprovacao | undefined {
  if (value === 'aguardando' || value === 'aprovado' || value === 'reprovado') {
    return value
  }

  return undefined
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = parseStatus(searchParams.get('status'))
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Number(searchParams.get('limit') ?? '20'))

  try {
    const where: Prisma.AprovacaoWhereInput = {
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
      { success: false, error: 'Erro ao buscar aprovacoes' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  let body: {
    aprovacaoId: string
    status: 'aprovado' | 'reprovado'
    comentario?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  const { aprovacaoId, status, comentario } = body

  if (!aprovacaoId || !['aprovado', 'reprovado'].includes(status)) {
    return NextResponse.json(
      { success: false, error: 'Dados invalidos' },
      { status: 400 },
    )
  }

  try {
    const aprovacao = await prisma.aprovacao.findUnique({
      where: { id: aprovacaoId },
      include: { entrega: true },
    })

    if (!aprovacao) {
      return NextResponse.json(
        { success: false, error: 'Aprovacao nao encontrada' },
        { status: 404 },
      )
    }

    if (session.user.perfil === 'cliente' && aprovacao.clienteId !== session.user.clienteId) {
      return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 403 })
    }

    if (aprovacao.status !== 'aguardando') {
      return NextResponse.json(
        { success: false, error: 'Esta aprovacao ja foi respondida' },
        { status: 409 },
      )
    }

    const aprovacaoAtualizada = await prisma.aprovacao.update({
      where: { id: aprovacaoId },
      data: {
        status,
        comentario: comentario?.trim() ?? null,
        aprovadoEm: new Date(),
      },
    })

    const novoStatusEntrega = status === 'aprovado' ? 'aprovado' : 'reprovado'
    await prisma.entrega.update({
      where: { id: aprovacao.entregaId },
      data: { status: novoStatusEntrega },
    })

    if (aprovacao.entrega.clickupTaskId) {
      try {
        await updateTaskStatus(aprovacao.entrega.clickupTaskId, novoStatusEntrega)

        if (comentario) {
          const autor = session.user.perfil === 'cliente' ? 'Cliente' : session.user.nome
          await addTaskComment(
            aprovacao.entrega.clickupTaskId,
            `[${status.toUpperCase()}] por ${autor}: ${comentario}`,
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
      { success: false, error: 'Erro ao registrar aprovacao' },
      { status: 500 },
    )
  }
}
