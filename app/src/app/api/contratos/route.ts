import type { Prisma, StatusContrato } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createDocument } from '@/lib/autentique'
import { notificarContrato } from '@/lib/whatsapp'
import type { CreateContratoPayload } from '@/types'

function parseStatus(value: string | null): StatusContrato | undefined {
  if (value === 'pendente' || value === 'enviado' || value === 'assinado' || value === 'cancelado') {
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
  const clienteId = searchParams.get('clienteId')
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Number(searchParams.get('limit') ?? '20'))

  try {
    const where: Prisma.ContratoWhereInput = {
      ...(session.user.perfil === 'cliente'
        ? { clienteId: session.user.clienteId }
        : {}),
      ...(status ? { status } : {}),
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
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  let body: CreateContratoPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  const { clienteId, propostaId, titulo, conteudo } = body

  if (!clienteId || !titulo?.trim() || !conteudo?.trim()) {
    return NextResponse.json(
      { success: false, error: 'clienteId, titulo e conteudo sao obrigatorios' },
      { status: 400 },
    )
  }

  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente nao encontrado' },
        { status: 404 },
      )
    }

    const autentiqueDoc = await createDocument({
      titulo,
      conteudoHtml: conteudo,
      signatarios: [
        {
          email: cliente.email,
          name: cliente.nome,
          action: 'SIGN',
        },
      ],
      mensagem: `Por favor, assine o contrato "${titulo}" da Volve.`,
    })

    const linkAssinatura = autentiqueDoc.signatures[0]?.link

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
