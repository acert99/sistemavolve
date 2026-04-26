import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ensureInstanceWebhookConfigured, getInstanceStatus, resetAndConnect } from '@/lib/whatsapp'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({})) as {
      confirmReset?: boolean
      number?: string | null
    }
    const status = await getInstanceStatus()
    if (status.connected) {
      const webhook = await ensureInstanceWebhookConfigured()
      return NextResponse.json({
        success: true,
        data: {
          connected: true,
          webhookConfigured: webhook.ok,
          webhookError: webhook.error,
        },
      })
    }

    if (!body.confirmReset) {
      return NextResponse.json(
        {
          success: false,
          error: 'A reconexao do WhatsApp precisa resetar a instancia atual. Confirme para continuar.',
          code: 'RESET_CONFIRMATION_REQUIRED',
        },
        { status: 409 },
      )
    }

    const { connect, error } = await resetAndConnect({ number: body.number ?? null })
    const webhook = await ensureInstanceWebhookConfigured()

    return NextResponse.json({
      success: true,
      data: {
        connected: false,
        qrcode: connect?.base64 ?? null,
        pairingCode: connect?.pairingCode ?? null,
        code: connect?.code ?? null,
        count: connect?.count ?? 0,
        error: error ?? null,
        webhookConfigured: webhook.ok,
        webhookError: webhook.error,
      },
    })
  } catch (err) {
    console.error('[POST /api/communication/whatsapp/connect]', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao iniciar conexao do WhatsApp' },
      { status: 500 },
    )
  }
}
