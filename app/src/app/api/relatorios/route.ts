import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { ClientReportType } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { parseDate } from '@/lib/client-reports'

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') return unauthorized()

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId') || undefined
  const status = searchParams.get('status') || undefined
  const type = searchParams.get('type') || undefined

  const reports = await prisma.clientReport.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(type ? { type: type as ClientReportType } : {}),
    },
    include: {
      cliente: { select: { id: true, nome: true } },
      _count: { select: { metrics: true, items: true, assets: true } },
    },
    orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  })

  return NextResponse.json({ success: true, data: reports })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') return unauthorized()

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })

  const clientId = String(body.clientId ?? '')
  const type = body.type === 'monthly' ? 'monthly' : 'weekly'
  const periodStart = parseDate(body.periodStart)
  const periodEnd = parseDate(body.periodEnd)

  if (!clientId || !periodStart || !periodEnd) {
    return NextResponse.json({ success: false, error: 'Cliente e periodo sao obrigatorios' }, { status: 400 })
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: clientId }, select: { nome: true } })
  if (!cliente) return NextResponse.json({ success: false, error: 'Cliente nao encontrado' }, { status: 404 })

  const monthRef = body.monthRef ? Number(body.monthRef) : periodStart.getMonth() + 1
  const yearRef = body.yearRef ? Number(body.yearRef) : periodStart.getFullYear()

  const report = await prisma.clientReport.create({
    data: {
      clientId,
      type,
      periodStart,
      periodEnd,
      monthRef,
      yearRef,
      title: body.title?.trim() || `${type === 'monthly' ? 'Relatorio mensal' : 'Relatorio semanal'} — ${cliente.nome}`,
      summary: body.summary?.trim() || null,
      highlights: body.highlights?.trim() || null,
      risks: body.risks?.trim() || null,
      nextSteps: body.nextSteps?.trim() || null,
      internalNotes: body.internalNotes?.trim() || null,
    },
  })

  return NextResponse.json({ success: true, data: report }, { status: 201 })
}
