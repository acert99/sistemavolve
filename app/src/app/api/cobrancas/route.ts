// =============================================================================
// API — Cobranças (integração Asaas)
// GET  /api/cobrancas  → lista cobranças
// POST /api/cobrancas  → cria cobrança no Asaas e notifica cliente
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import {
  createCharge,
  createOrFindCustomer,
  getPixQrCode,
} from '@/lib/asaas'
import { notificarCobranca } from '@/lib/whatsapp'
import type { CreateCobrancaPayload } from '@/types'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status    = searchParams.get('status')
  const clienteId = searchParams.get('clienteId')
  const page      = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit     = Math.min(50, Number(searchParams.get('limit') ?? '20'))

  try {
    const where = {
      ...(session.user.perfil === 'cliente'
        ? { clienteId: session.user.clienteId }
        : {}),
      ...(status    ? { status }    : {}),
      ...(clienteId ? { clienteId } : {}),
    }

    const [cobrancas, total] = await Promise.all([
      prisma.cobranca.findMany({
        where,
        include: {
          cliente: { select: { id: true, nome: true, email: true } },
          contrato: { select: { id: true, titulo: true } },
        },
        orderBy: { vencimento: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cobranca.count({ where }),
    ])

    // Resumo financeiro
    const vencidas = await prisma.cobranca.count({
      where: {
        ...where,
        status: 'OVERDUE',
      },
    })

    return NextResponse.json({
      success: true,
      data: cobrancas,
      meta: {
        total,
        vencidas,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('[GET /api/cobrancas]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar cobranças' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  let body: CreateCobrancaPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { clienteId, contratoId, descricao, valor, vencimento, tipo = 'UNDEFINED' } = body

  if (!clienteId || !descricao?.trim() || !valor || !vencimento) {
    return NextResponse.json(
      { success: false, error: 'clienteId, descricao, valor e vencimento são obrigatórios' },
      { status: 400 },
    )
  }

  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente não encontrado' },
        { status: 404 },
      )
    }

    // Garante que o cliente existe no Asaas
    let asaasCustomerId = cliente.asaasId
    if (!asaasCustomerId) {
      const asaasCustomer = await createOrFindCustomer({
        nome: cliente.nome,
        email: cliente.email,
        cpfCnpj: cliente.cpfCnpj ?? undefined,
        whatsapp: cliente.whatsapp ?? undefined,
      })
      asaasCustomerId = asaasCustomer.id

      // Salva o ID Asaas no cliente para uso futuro
      await prisma.cliente.update({
        where: { id: clienteId },
        data: { asaasId: asaasCustomerId },
      })
    }

    // Formata vencimento para YYYY-MM-DD
    const dueDateStr = new Date(vencimento).toISOString().split('T')[0]

    // Cria cobrança no Asaas
    const asaasCharge = await createCharge({
      customerId: asaasCustomerId,
      description: descricao,
      value: valor,
      dueDate: dueDateStr,
      billingType: tipo as 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED',
      externalReference: clienteId,
    })

    // Busca QR Code PIX (se aplicável)
    let pixCopaCola: string | null = null
    if (tipo === 'PIX' || tipo === 'UNDEFINED') {
      try {
        const pix = await getPixQrCode(asaasCharge.id)
        pixCopaCola = pix.payload
      } catch {
        // PIX pode não estar disponível imediatamente
      }
    }

    // Salva no banco
    const cobranca = await prisma.cobranca.create({
      data: {
        clienteId,
        contratoId: contratoId ?? null,
        asaasId: asaasCharge.id,
        descricao: descricao.trim(),
        valor,
        vencimento: new Date(vencimento),
        tipo,
        status: asaasCharge.status,
        linkPagamento: asaasCharge.invoiceUrl ?? null,
        invoiceUrl: asaasCharge.invoiceUrl ?? null,
        pixCopaCola,
      },
    })

    // Notifica cliente via WhatsApp
    if (cliente.whatsapp && asaasCharge.invoiceUrl) {
      await notificarCobranca({
        phone: cliente.whatsapp,
        clienteNome: cliente.nome,
        descricao,
        valor,
        vencimento: new Date(vencimento),
        linkPagamento: asaasCharge.invoiceUrl,
      })

      // Registra que foi notificado
      await prisma.cobranca.update({
        where: { id: cobranca.id },
        data: { notificadoEm: new Date() },
      })
    }

    return NextResponse.json({ success: true, data: cobranca }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/cobrancas]', err)
    const msg = err instanceof Error ? err.message : 'Erro ao criar cobrança'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
