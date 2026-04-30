import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { ClientReportServiceType } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body?.clientId) return NextResponse.json({ success: false, error: 'Cliente obrigatorio' }, { status: 400 })
  const profile = await prisma.clientReportProfile.upsert({
    where: { clientId: String(body.clientId) },
    create: {
      clientId: String(body.clientId),
      reportTone: body.reportTone ? String(body.reportTone) : null,
      serviceType: (body.serviceType || 'content') as ClientReportServiceType,
      promisedFrequency: body.promisedFrequency ? Number(body.promisedFrequency) : null,
      mainChannels: Array.isArray(body.mainChannels) ? body.mainChannels.map(String) : [],
      primaryGoals: Array.isArray(body.primaryGoals) ? body.primaryGoals.map(String) : [],
      importantNotes: body.importantNotes ? String(body.importantNotes) : null,
      metricsEnabled: Array.isArray(body.metricsEnabled) ? body.metricsEnabled.map(String) : [],
      templateVariant: body.templateVariant ? String(body.templateVariant) : null,
    },
    update: {
      reportTone: body.reportTone ? String(body.reportTone) : null,
      serviceType: (body.serviceType || 'content') as ClientReportServiceType,
      promisedFrequency: body.promisedFrequency ? Number(body.promisedFrequency) : null,
      mainChannels: Array.isArray(body.mainChannels) ? body.mainChannels.map(String) : [],
      primaryGoals: Array.isArray(body.primaryGoals) ? body.primaryGoals.map(String) : [],
      importantNotes: body.importantNotes ? String(body.importantNotes) : null,
      metricsEnabled: Array.isArray(body.metricsEnabled) ? body.metricsEnabled.map(String) : [],
      templateVariant: body.templateVariant ? String(body.templateVariant) : null,
    },
  })
  return NextResponse.json({ success: true, data: profile })
}
