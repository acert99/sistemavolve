// =============================================================================
// API — Calendario de Conteudo (MVP) — Ideias (geracao placeholder)
// POST /api/calendario-conteudo/ideias/generate { clientId, month }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const bodySchema = z.object({
  clientId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
})

function pickIdeaSeed(index: number) {
  const seeds = [
    { title: 'Reels educativo', description: 'Dica rápida + CTA para comentar dúvida.' },
    { title: 'Carrossel guia', description: 'Passo a passo em 6 slides, com checklist.' },
    { title: 'Stories bastidores', description: 'Rotina do dia + enquete para engajar.' },
    { title: 'Post prova social', description: 'Depoimento/resultado com contexto e promessa realista.' },
    { title: 'Live curta (20min)', description: 'Tema do mês + perguntas ao vivo.' },
    { title: 'FAQ do mês', description: 'Top 5 perguntas frequentes com respostas objetivas.' },
  ]
  return seeds[index % seeds.length]
}

function buildScheduledDate(monthKey: string, day: number) {
  const [year, month] = monthKey.split('-').map(Number)
  // Date.UTC to keep day stable; saved as DATE in DB
  return new Date(Date.UTC(year, (month || 1) - 1, day))
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Payload inválido' },
      { status: 400 },
    )
  }

  const { clientId, month } = parsed.data

  try {
    const existing = await prisma.calendarioIdeia.count({
      where: { clienteId: clientId, monthKey: month },
    })

    if (existing > 0) {
      const ideas = await prisma.calendarioIdeia.findMany({
        where: { clienteId: clientId, monthKey: month },
        orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
      })
      return NextResponse.json({ success: true, data: ideas, meta: { created: 0 } })
    }

    const days = [3, 7, 10, 14, 17, 21, 24, 28]
    const data = days.map((day, index) => {
      const seed = pickIdeaSeed(index)
      return {
        clienteId: clientId,
        monthKey: month,
        title: `${seed.title} — ${day}/${month.split('-')[1]}`,
        description: seed.description,
        scheduledDate: buildScheduledDate(month, day),
        status: 'draft' as const,
      }
    })

    await prisma.calendarioIdeia.createMany({ data })

    const ideas = await prisma.calendarioIdeia.findMany({
      where: { clienteId: clientId, monthKey: month },
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({ success: true, data: ideas, meta: { created: data.length } }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/calendario-conteudo/ideias/generate]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao gerar ideias' },
      { status: 500 },
    )
  }
}

