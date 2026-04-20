import { NextRequest, NextResponse } from 'next/server'
import { registerLeadIncomingMessage } from '@/lib/leads'

function getWebhookToken(request: NextRequest) {
  return (
    request.headers.get('x-webhook-token') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    ''
  )
}

function extractPhone(payload: Record<string, any>) {
  return (
    payload.phone ??
    payload.from ??
    payload.remoteJid ??
    payload.key?.remoteJid ??
    payload.data?.key?.remoteJid ??
    null
  )
}

function extractContent(payload: Record<string, any>) {
  return (
    payload.message ??
    payload.text ??
    payload.body ??
    payload.data?.message?.conversation ??
    payload.data?.message?.extendedTextMessage?.text ??
    payload.content ??
    'Lead respondeu no WhatsApp'
  )
}

export async function POST(request: NextRequest) {
  const expected = process.env.EVOLUTION_WEBHOOK_SECRET ?? process.env.CRON_SECRET ?? ''
  const provided = getWebhookToken(request)

  if (expected && provided && provided !== expected) {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  let payload: Record<string, any>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  const phone = extractPhone(payload)
  if (!phone) {
    return NextResponse.json(
      { success: false, error: 'Telefone nao encontrado no payload' },
      { status: 400 },
    )
  }

  try {
    const lead = await registerLeadIncomingMessage({
      phone: String(phone),
      content: String(extractContent(payload) ?? ''),
      metadata: payload,
    })

    return NextResponse.json({
      success: true,
      data: {
        matched: Boolean(lead),
        leadId: lead?.id ?? null,
      },
    })
  } catch (error) {
    console.error('[POST /api/webhooks/whatsapp-received]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao processar resposta do WhatsApp' },
      { status: 500 },
    )
  }
}
