// =============================================================================
// API — Clientes (listagem e criação)
// GET  /api/clientes  → lista todos os clientes
// POST /api/clientes  → cria novo cliente
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { createOrFindCustomer } from '@/lib/asaas'
import type { CreateClientePayload } from '@/types'

// ---------------------------------------------------------------------------
// GET — lista clientes com paginação e busca
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page   = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit  = Math.min(100, Number(searchParams.get('limit') ?? '20'))
  const search = searchParams.get('q') ?? ''
  const ativo  = searchParams.get('ativo')

  try {
    const where = {
      ...(ativo !== null ? { ativo: ativo === 'true' } : {}),
      ...(search
        ? {
            OR: [
              { nome:    { contains: search, mode: 'insensitive' as const } },
              { email:   { contains: search, mode: 'insensitive' as const } },
              { cpfCnpj: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cliente.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: clientes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('[GET /api/clientes]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar clientes' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// POST — cria novo cliente (e sincroniza no Asaas)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  let body: CreateClientePayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { nome, email, whatsapp, cpfCnpj } = body

  // Validações básicas
  if (!nome?.trim() || !email?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Nome e e-mail são obrigatórios' },
      { status: 400 },
    )
  }

  // Verifica duplicidade
  const existente = await prisma.cliente.findFirst({
    where: { email: email.toLowerCase().trim() },
  })

  if (existente) {
    return NextResponse.json(
      { success: false, error: 'Já existe um cliente com este e-mail' },
      { status: 409 },
    )
  }

  try {
    // Cria no Asaas (sincroniza para futura cobrança)
    let asaasId: string | undefined
    try {
      const asaasCustomer = await createOrFindCustomer({
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        cpfCnpj,
        whatsapp,
      })
      asaasId = asaasCustomer.id
    } catch (asaasErr) {
      // Não bloqueia a criação local se o Asaas falhar
      console.warn('[POST /api/clientes] Asaas sync falhou:', asaasErr)
    }

    const cliente = await prisma.cliente.create({
      data: {
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        whatsapp: whatsapp?.replace(/\D/g, '') ?? null,
        cpfCnpj: cpfCnpj?.replace(/\D/g, '') ?? null,
        asaasId: asaasId ?? null,
      },
    })

    return NextResponse.json({ success: true, data: cliente }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/clientes]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar cliente' },
      { status: 500 },
    )
  }
}
