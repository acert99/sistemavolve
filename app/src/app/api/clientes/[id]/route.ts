// =============================================================================
// API — Cliente individual
// GET    /api/clientes/[id]  → busca cliente
// PUT    /api/clientes/[id]  → atualiza cliente
// DELETE /api/clientes/[id]  → desativa cliente (soft delete)
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

type Params = { params: { id: string } }

// ---------------------------------------------------------------------------
// GET — busca cliente pelo ID
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  // Cliente só pode ver seus próprios dados
  if (
    session.user.perfil === 'cliente' &&
    session.user.clienteId !== params.id
  ) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 403 })
  }

  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            propostas: true,
            contratos: true,
            cobrancas: true,
          },
        },
      },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente não encontrado' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: cliente })
  } catch (err) {
    console.error('[GET /api/clientes/[id]]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar cliente' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// PUT — atualiza dados do cliente
// ---------------------------------------------------------------------------
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

  const { nome, email, whatsapp, cpfCnpj, ativo } = body as {
    nome?: string
    email?: string
    whatsapp?: string
    cpfCnpj?: string
    ativo?: boolean
  }

  try {
    const cliente = await prisma.cliente.update({
      where: { id: params.id },
      data: {
        ...(nome    !== undefined ? { nome: nome.trim() } : {}),
        ...(email   !== undefined ? { email: email.toLowerCase().trim() } : {}),
        ...(whatsapp !== undefined ? { whatsapp: whatsapp.replace(/\D/g, '') } : {}),
        ...(cpfCnpj !== undefined ? { cpfCnpj: cpfCnpj.replace(/\D/g, '') } : {}),
        ...(ativo   !== undefined ? { ativo } : {}),
      },
    })

    return NextResponse.json({ success: true, data: cliente })
  } catch (err: unknown) {
    // Prisma erro de not found
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Cliente não encontrado' },
        { status: 404 },
      )
    }
    console.error('[PUT /api/clientes/[id]]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar cliente' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE — desativa cliente (soft delete preserva histórico)
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  try {
    await prisma.cliente.update({
      where: { id: params.id },
      data: { ativo: false },
    })

    return NextResponse.json({ success: true, message: 'Cliente desativado' })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Cliente não encontrado' },
        { status: 404 },
      )
    }
    console.error('[DELETE /api/clientes/[id]]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao desativar cliente' },
      { status: 500 },
    )
  }
}
