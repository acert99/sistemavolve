// =============================================================================
// API — Contratos (integração Autentique)
// GET  /api/contratos  → lista contratos
// POST /api/contratos  → cria contrato e envia para assinatura no Autentique
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { createDocument } from '@/lib/autentique'
import { notificarContrato } from '@/lib/whatsapp'
import type { CreateContratoPayload } from '@/types'

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

    const [contratos, total] = await Promise.all([
      prisma.contrato.findMany({
        where,
        include: {
          cliente: { select: { id: true, nome: true, email: true } },
          proposta: { select: { id: true, titulo: true, valorTotal: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contrato.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: contratos,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[GET /api/contratos]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar contratos' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  let body: CreateContratoPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { clienteId, propostaId, titulo, conteudo } = body

  if (!clienteId || !titulo?.trim() || !conteudo?.trim()) {
    return NextResponse.json(
      { success: false, error: 'clienteId, titulo e conteudo são obrigatórios' },
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

    // Cria o documento no Autentique e define os signatários
    // Signatário: cliente (assina) + representante da agência (opcional)
    const autentiqueDoc = await createDocument({
      titulo,
      conteudoHtml: conteudo,
      signatarios: [
        {
          email: cliente.email,
          name: cliente.nome,
          action: 'SIGN',
        },
        // Adicione o assinante da agência se necessário:
        // { email: 'juridico@volve.com.br', name: 'Volve Agência', action: 'SIGN' },
      ],
      mensagem: `Por favor, assine o contrato "${titulo}" da Volve.`,
    })

    // O link de assinatura é o primeiro signatário (o cliente)
    const linkAssinatura = autentiqueDoc.signatures[0]?.link

    // Salva no banco
    const contrato = await prisma.contrato.create({
      data: {
        clienteId,
        propostaId: propostaId ?? null,
        autentiqueId: autentiqueDoc.id,
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        status: 'enviado',
        linkAssinatura: linkAssinatura ?? null,
      },
    })

    // Notifica cliente via WhatsApp
    if (cliente.whatsapp && linkAssinatura) {
      await notificarContrato({
        phone: cliente.whatsapp,
        clienteNome: cliente.nome,
        tituloContrato: titulo,
        linkAssinatura,
      })
    }

    return NextResponse.json({ success: true, data: contrato }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/contratos]', err)
    const msg = err instanceof Error ? err.message : 'Erro ao criar contrato'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
