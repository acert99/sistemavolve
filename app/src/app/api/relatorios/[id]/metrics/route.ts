import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { ClientReportSource } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { upsertMetric } from '@/lib/client-reports'

function unauthorized() { return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 }) }

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') return unauthorized()
  const report = await prisma.clientReport.findUnique({ where: { id: params.id } })
  if (!report) return NextResponse.json({ success: false, error: 'Relatorio nao encontrado' }, { status: 404 })
  if (report.status === 'sent') return NextResponse.json({ success: false, error: 'Relatorio enviado nao pode ser editado' }, { status: 409 })
  const body = await request.json().catch(() => null)
  if (!body?.metricKey || !body?.label) return NextResponse.json({ success: false, error: 'Metrica invalida' }, { status: 400 })
  const value = body.value === '' || body.value === undefined || body.value === null ? null : Number(body.value)
  const metric = await upsertMetric(params.id, String(body.metricKey), String(body.label), Number.isFinite(value as number) ? value : null, body.unit ? String(body.unit) : null, (body.source || 'manual') as ClientReportSource, body.notes ? String(body.notes) : null)
  return NextResponse.json({ success: true, data: metric }, { status: 201 })
}
