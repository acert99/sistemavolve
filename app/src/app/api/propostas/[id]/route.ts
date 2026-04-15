// =============================================================================
// API — Proposta individual + ações (enviar, aceitar, recusar)
// GET  /api/propostas/[id]          → busca proposta
// PUT  /api/propostas/[id]          → atualiza proposta
// POST /api/propostas/[id]/enviar   → envia para cliente via WhatsApp
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { notificarProposta } from '@/lib/whatsapp'

type Params = { params: { id: string } }

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const proposta = await prisma.proposta.findUnique({
      where: { id: params.id },
      include: {
        cliente: true,
      },
    })

    if (!proposta) {
      return NextResponse.json(
        { success: false, error: 'Proposta não encontrada' },
        { status: 404 },
      )
    }

    // Cliente só pode ver suas próprias propostas
    if (
      session.user.perfil === 'cliente' &&
      proposta.clienteId !== session.user.clienteId
    ) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 403 })
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
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { action, ...updateData } = body

  try {
    // Ação especial: enviar para cliente via WhatsApp
    if (action === 'enviar') {
      const proposta = await prisma.proposta.findUnique({
        where: { id: params.id },
        include: { cliente: true },
      })

      if (!proposta) {
        return NextResponse.json(
          { success: false, error: 'Proposta não encontrada' },
          { status: 404 },
        )
      }

      const linkProposta =
        `${process.env.NEXT_PUBLIC_VPS_API_URL}/propostas/${proposta.token}`

      // Envia WhatsApp se cliente tiver número
      if (proposta.cliente.whatsapp) {
        await notificarProposta({
          phone: proposta.cliente.whatsapp,
          clienteNome: proposta.cliente.nome,
          tituloProposta: proposta.titulo,
          valorTotal: Number(proposta.valorTotal),
          linkProposta,
        })
      }

      const atualizada = await prisma.proposta.update({
        where: { id: params.id },
        data: { status: 'enviada' },
      })

      return NextResponse.json({ success: true, data: atualizada })
    }

    // Atualização de campos
    const proposta = await prisma.proposta.update({
      where: { id: params.id },
      data: {
        ...(updateData.titulo ? { titulo: String(updateData.titulo).trim() } : {}),
        ...(updateData.descricao !== undefined
          ? { descricao: updateData.descricao ? String(updateData.descricao).trim() : null }
          : {}),
        ...(updateData.itens ? { itens: updateData.itens as object } : {}),
        ...(updateData.valorTotal !== undefined
          ? { valorTotal: Number(updateData.valorTotal) }
          : {}),
        ...(updateData.validade !== undefined
          ? { validade: updateData.validade ? new Date(String(updateData.validade)) : null }
          : {}),
        ...(updateData.status ? { status: String(updateData.status) } : {}),
      },
    })

    return NextResponse.json({ success: true, data: proposta })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Proposta não encontrada' },
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
