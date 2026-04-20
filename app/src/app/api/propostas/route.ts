import { randomUUID } from 'crypto'
import type { Prisma, StatusProposta } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generatePropostaPDF } from '@/lib/pdf'
import { parseDateOnlyInAppTimeZone } from '@/lib/timezone'
import type { CreatePropostaPayload } from '@/types'

function parseStatus(value: string | null): StatusProposta | undefined {
  if (
    value === 'rascunho' ||
    value === 'enviada' ||
    value === 'visualizada' ||
    value === 'aceita' ||
    value === 'recusada' ||
    value === 'expirada'
  ) {
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
  const leadId = searchParams.get('leadId')
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Number(searchParams.get('limit') ?? '20'))

  try {
    const where: Prisma.PropostaWhereInput = {
      ...(session.user.perfil === 'cliente'
        ? { clienteId: session.user.clienteId }
        : {}),
      ...(status ? { status } : {}),
      ...(clienteId ? { clienteId } : {}),
      ...(leadId ? { leadId } : {}),
    }

    const [propostas, total] = await Promise.all([
      prisma.proposta.findMany({
        where,
        include: {
          cliente: { select: { id: true, nome: true, email: true, whatsapp: true } },
          lead: { select: { id: true, name: true, email: true, phone: true, stage: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.proposta.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: propostas,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[GET /api/propostas]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar propostas' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  let body: CreatePropostaPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  const { clienteId, leadId, titulo, descricao, itens, validade } = body

  if ((!clienteId && !leadId) || !titulo?.trim() || !itens?.length) {
    return NextResponse.json(
      { success: false, error: 'clienteId ou leadId, titulo e itens sao obrigatorios' },
      { status: 400 },
    )
  }

  const valorTotal = itens.reduce(
    (acc, item) => acc + item.quantidade * item.valorUnitario,
    0,
  )
  const validadeDate = validade ? parseDateOnlyInAppTimeZone(validade) : null

  if (validade && !validadeDate) {
    return NextResponse.json(
      { success: false, error: 'Data de validade inválida' },
      { status: 400 },
    )
  }

  const token = randomUUID().replace(/-/g, '').slice(0, 16)

  try {
    const [cliente, lead] = await Promise.all([
      clienteId
        ? prisma.cliente.findUnique({
            where: { id: clienteId },
          })
        : Promise.resolve(null),
      leadId
        ? prisma.lead.findUnique({
            where: { id: leadId },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              stage: true,
            },
          })
        : Promise.resolve(null),
    ])

    if (!clienteId && !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead nao encontrado' },
        { status: 404 },
      )
    }

    if (clienteId && !cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente nao encontrado' },
        { status: 404 },
      )
    }

    const proposta = await prisma.proposta.create({
      data: {
        clienteId: clienteId ?? null,
        leadId: leadId ?? null,
        titulo: titulo.trim(),
        descricao: descricao?.trim() ?? null,
        itens: itens as unknown as Prisma.InputJsonValue,
        valorTotal,
        token,
        status: 'rascunho',
        validade: validadeDate,
      },
      include: {
        cliente: { select: { nome: true, email: true, whatsapp: true } },
        lead: { select: { name: true, email: true, phone: true } },
      },
    })

    setImmediate(async () => {
      try {
        const pdfBuffer = await generatePropostaPDF({
          id: proposta.id,
          titulo: proposta.titulo,
          descricao: proposta.descricao,
          itens: proposta.itens as unknown as Prisma.InputJsonValue,
          valorTotal: Number(proposta.valorTotal),
          createdAt: proposta.createdAt,
          validade: proposta.validade,
          cliente: proposta.cliente ?? {
            nome: proposta.lead?.name ?? 'Lead',
            email: proposta.lead?.email ?? '',
          },
        })

        console.log(`[PDF] Proposta ${proposta.id} gerada (${pdfBuffer.length} bytes)`)
      } catch (pdfErr) {
        console.error('[PDF] Erro ao gerar PDF:', pdfErr)
      }
    })

    return NextResponse.json({ success: true, data: proposta }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/propostas]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar proposta' },
      { status: 500 },
    )
  }
}
