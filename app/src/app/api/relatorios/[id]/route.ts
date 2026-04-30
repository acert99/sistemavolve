import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { ClientReportStatus } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { parseDate, updateReportStatus } from '@/lib/client-reports'

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') return unauthorized()

  const report = await prisma.clientReport.findUnique({
    where: { id: params.id },
    include: {
      cliente: true,
      metrics: { orderBy: { createdAt: 'asc' } },
      items: { orderBy: [{ type: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'asc' }] },
      assets: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!report) return NextResponse.json({ success: false, error: 'Relatorio nao encontrado' }, { status: 404 })
  return NextResponse.json({ success: true, data: report })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') return unauthorized()

  const report = await prisma.clientReport.findUnique({ where: { id: params.id } })
  if (!report) return NextResponse.json({ success: false, error: 'Relatorio nao encontrado' }, { status: 404 })
  if (report.status === 'sent') {
    return NextResponse.json({ success: false, error: 'Relatorio enviado nao pode ser editado sem confirmacao operacional' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })

  if (body.status) {
    const updated = await updateReportStatus(report, body.status as ClientReportStatus)
    return NextResponse.json({ success: true, data: updated })
  }

  const periodStart = body.periodStart ? parseDate(body.periodStart) : undefined
  const periodEnd = body.periodEnd ? parseDate(body.periodEnd) : undefined

  const updated = await prisma.clientReport.update({
    where: { id: params.id },
    data: {
      ...(periodStart ? { periodStart } : {}),
      ...(periodEnd ? { periodEnd } : {}),
      ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
      ...(body.summary !== undefined ? { summary: String(body.summary).trim() || null } : {}),
      ...(body.highlights !== undefined ? { highlights: String(body.highlights).trim() || null } : {}),
      ...(body.risks !== undefined ? { risks: String(body.risks).trim() || null } : {}),
      ...(body.nextSteps !== undefined ? { nextSteps: String(body.nextSteps).trim() || null } : {}),
      ...(body.internalNotes !== undefined ? { internalNotes: String(body.internalNotes).trim() || null } : {}),
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
