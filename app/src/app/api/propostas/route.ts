// =============================================================================
// API — Propostas
// GET  /api/propostas  → lista propostas
// POST /api/propostas  → cria proposta, gera PDF e envia WhatsApp
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { generatePropostaPDF } from '@/lib/pdf'
import { notificarProposta } from '@/lib/whatsapp'
import { randomUUID } from 'crypto'
import type { CreatePropostaPayload } from '@/types'

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
      // Cliente só vê suas propostas
      ...(session.user.perfil === 'cliente'
        ? { clienteId: session.user.clienteId }
        : {}),
      ...(status    ? { status }    : {}),
      ...(clienteId ? { clienteId } : {}),
    }

    const [propostas, total] = await Promise.all([
      prisma.proposta.findMany({
        where,
        include: {
          cliente: { select: { id: true, nome: true, email: true, whatsapp: true } },
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
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  let body: CreatePropostaPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { clienteId, titulo, descricao, itens, validade } = body

  if (!clienteId || !titulo?.trim() || !itens?.length) {
    return NextResponse.json(
      { success: false, error: 'clienteId, titulo e itens são obrigatórios' },
      { status: 400 },
    )
  }

  // Calcula total
  const valorTotal = itens.reduce(
    (acc, item) => acc + item.quantidade * item.valorUnitario,
    0,
  )

  // Token único para o link público (ex: /propostas/abc123)
  const token = randomUUID().replace(/-/g, '').slice(0, 16)

  try {
    // Busca cliente para ter dados de contato
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente não encontrado' },
        { status: 404 },
      )
    }

    // Cria a proposta no banco
    const proposta = await prisma.proposta.create({
      data: {
        clienteId,
        titulo: titulo.trim(),
        descricao: descricao?.trim() ?? null,
        itens: itens as unknown as object,
        valorTotal,
        token,
        status: 'rascunho',
        validade: validade ? new Date(validade) : null,
      },
      include: {
        cliente: { select: { id: true, nome: true, email: true, whatsapp: true } },
      },
    })

    // Gera PDF em background (não bloqueia a resposta)
    // Em produção, use uma fila (Redis Bull) para isso
    setImmediate(async () => {
      try {
        const pdfBuffer = await generatePropostaPDF({
          ...proposta,
          valorTotal: Number(proposta.valorTotal),
          itens: proposta.itens as any,
        })

        // Aqui você salvaria o PDF em um storage (S3, R2, Supabase Storage, etc.)
        // e atualizaria o campo pdfUrl no banco
        // Exemplo:
        // const url = await uploadToStorage(pdfBuffer, `propostas/${proposta.id}.pdf`)
        // await prisma.proposta.update({ where: { id: proposta.id }, data: { pdfUrl: url } })

        console.log(`[PDF] Proposta ${proposta.id} gerada (${pdfBuffer.length} bytes)`)
      } catch (pdfErr) {
        console.error('[PDF] Erro ao gerar PDF:', pdfErr)
      }
    })

    return NextResponse.json(
      { success: true, data: proposta },
      { status: 201 },
    )
  } catch (err) {
    console.error('[POST /api/propostas]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar proposta' },
      { status: 500 },
    )
  }
}
