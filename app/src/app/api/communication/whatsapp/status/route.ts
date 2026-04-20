import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getInstanceStatus } from '@/lib/whatsapp'

function toDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  try {
    const status = await getInstanceStatus()
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME ?? 'volve'

    const canal = await prisma.canalWhatsApp.upsert({
      where: {
        provider_instanceName: {
          provider: 'evolution',
          instanceName,
        },
      },
      update: {
        status: status.status,
        phoneNumber: status.phoneNumber,
        lastConnectionAt: status.connected
          ? toDate(status.lastConnectionAt) ?? new Date()
          : undefined,
        lastError: status.status === 'error' ? status.lastError : null,
      },
      create: {
        provider: 'evolution',
        instanceName,
        status: status.status,
        phoneNumber: status.phoneNumber,
        lastConnectionAt: status.connected
          ? toDate(status.lastConnectionAt) ?? new Date()
          : null,
        lastError: status.status === 'error' ? status.lastError : null,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...canal,
        connected: status.connected,
        rawState: status.rawState,
      },
    })
  } catch (err) {
    console.error('[GET /api/communication/whatsapp/status]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao consultar status do WhatsApp' },
      { status: 500 },
    )
  }
}
