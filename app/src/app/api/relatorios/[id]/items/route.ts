import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { ClientReportItemType, ClientReportSource } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { parseDate } from '@/lib/client-reports'

function unauthorized() { return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 }) }

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') return unauthorized()
  const report = await prisma.clientReport.findUnique({ where: { id: params.id } })
  if (!report) return NextResponse.json({ success: false, error: 'Relatorio nao encontrado' }, { status: 404 })
  if (report.status === 'sent') return NextResponse.json({ success: false, error: 'Relatorio enviado nao pode ser editado' }, { status: 409 })
  const body = await request.json().catch(() => null)
  if (!body?.title) return NextResponse.json({ success: false, error: 'Titulo obrigatorio' }, { status: 400 })
  const item = await prisma.clientReportItem.create({
    data: {
      reportId: params.id,
      type: (body.type || 'strategic_note') as ClientReportItemType,
      title: String(body.title).trim(),
      description: body.description ? String(body.description).trim() : null,
      date: parseDate(body.date),
      status: body.status ? String(body.status).trim() : null,
      source: (body.source || 'manual') as ClientReportSource,
      sourceTaskId: body.sourceTaskId ? String(body.sourceTaskId).trim() : null,
      sourceTaskUrl: body.sourceTaskUrl ? String(body.sourceTaskUrl).trim() : null,
      contentUrl: body.contentUrl ? String(body.contentUrl).trim() : null,
      orderIndex: Number(body.orderIndex || 0),
    },
  })
  return NextResponse.json({ success: true, data: item }, { status: 201 })
}
