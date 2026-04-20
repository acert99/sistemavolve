// =============================================================================
// API — Catálogo de Serviços
// GET  /api/servicos  → lista serviços
// POST /api/servicos  → cria serviço
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  // Catálogo é visível para equipe e clientes logados
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const categoria = searchParams.get('categoria')
  const ativo = searchParams.get('ativo') ?? 'true'

  try {
    const servicos = await prisma.servico.findMany({
      where: {
        ativo: ativo === 'true',
        ...(categoria ? { categoria } : {}),
      },
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    })

    // Agrupa por categoria para facilitar exibição
    const categorias = [...new Set(servicos.map((s) => s.categoria ?? 'Outros'))]
    const agrupado = categorias.map((cat) => ({
      categoria: cat,
      servicos: servicos.filter((s) => (s.categoria ?? 'Outros') === cat),
    }))

    return NextResponse.json({ success: true, data: servicos, agrupado })
  } catch (err) {
    console.error('[GET /api/servicos]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar serviços' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  let body: {
    nome: string
    descricao?: string
    preco: number
    categoria?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { nome, descricao, preco, categoria } = body

  if (!nome?.trim() || preco === undefined || preco < 0) {
    return NextResponse.json(
      { success: false, error: 'Nome e preço válido são obrigatórios' },
      { status: 400 },
    )
  }

  try {
    const servico = await prisma.servico.create({
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() ?? null,
        preco,
        categoria: categoria?.trim() ?? null,
      },
    })

    return NextResponse.json({ success: true, data: servico }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/servicos]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar serviço' },
      { status: 500 },
    )
  }
}
