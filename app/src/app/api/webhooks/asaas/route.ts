// =============================================================================
// Webhook — Asaas (Gateway de Pagamento)
// POST /api/webhooks/asaas
// Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, etc.
// Configurar em: painel.asaas.com > Configurações > Webhooks
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validateWebhookToken } from '@/lib/asaas'
import { parseDateOnlyInAppTimeZone } from '@/lib/timezone'

// Mapeamento de status Asaas → status interno
const STATUS_MAP: Record<string, string> = {
  PENDING:                        'PENDING',
  RECEIVED:                       'RECEIVED',
  CONFIRMED:                      'CONFIRMED',
  OVERDUE:                        'OVERDUE',
  REFUNDED:                       'REFUNDED',
  RECEIVED_IN_CASH:               'RECEIVED_IN_CASH',
  REFUND_REQUESTED:               'REFUND_REQUESTED',
  CHARGEBACK_REQUESTED:           'CHARGEBACK_REQUESTED',
  CHARGEBACK_DISPUTE:             'CHARGEBACK_DISPUTE',
  AWAITING_CHARGEBACK_REVERSAL:   'AWAITING_CHARGEBACK_REVERSAL',
  DUNNING_REQUESTED:              'DUNNING_REQUESTED',
  DUNNING_RECEIVED:               'DUNNING_RECEIVED',
  AWAITING_RISK_ANALYSIS:         'AWAITING_RISK_ANALYSIS',
}

export async function POST(request: NextRequest) {
  // O Asaas documenta o header `asaas-access-token`.
  // Mantemos compatibilidade com `access_token` para contas legadas.
  const tokenHeader =
    request.headers.get('asaas-access-token') ??
    request.headers.get('access_token') ??
    ''

  if (!validateWebhookToken(tokenHeader)) {
    console.warn('[Webhook Asaas] Token inválido')
    return NextResponse.json(
      { success: false, error: 'Token inválido' },
      { status: 401 },
    )
  }

  let payload: {
    event: string
    payment: {
      id: string
      customer: string
      value: number
      netValue: number
      status: string
      dueDate: string
      paymentDate?: string
      billingType: string
      invoiceUrl?: string
      bankSlipUrl?: string
      encodedImage?: string
      payload?: string
    }
  }

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { event, payment } = payload

  console.log(`[Webhook Asaas] Evento: ${event} | Payment: ${payment.id}`)

  // Eventos relevantes
  const eventosRelevantes = [
    'PAYMENT_RECEIVED',
    'PAYMENT_CONFIRMED',
    'PAYMENT_OVERDUE',
    'PAYMENT_UPDATED',
    'PAYMENT_REFUNDED',
  ]

  if (!eventosRelevantes.includes(event)) {
    return NextResponse.json({ success: true, message: 'Evento ignorado' })
  }

  try {
    // Busca a cobrança pelo asaasId
    const cobranca = await prisma.cobranca.findFirst({
      where: { asaasId: payment.id },
      include: {
        cliente: {
          select: { id: true, nome: true, email: true, whatsapp: true },
        },
      },
    })

    if (!cobranca) {
      console.warn(`[Webhook Asaas] Cobrança ${payment.id} não encontrada no banco`)
      return NextResponse.json({ success: true })
    }

    const novoStatus = STATUS_MAP[payment.status] ?? payment.status
    const isPago = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(payment.status)
    const pagoEm = payment.paymentDate
      ? parseDateOnlyInAppTimeZone(payment.paymentDate) ?? new Date()
      : new Date()

    // Atualiza status no banco
    await prisma.cobranca.update({
      where: { id: cobranca.id },
      data: {
        status: novoStatus,
        ...(isPago ? { pagoEm } : {}),
        ...(payment.invoiceUrl ? { invoiceUrl: payment.invoiceUrl } : {}),
        ...(payment.payload ? { pixCopaCola: payment.payload } : {}),
      },
    })

    console.log(
      `[Webhook Asaas] Cobrança ${cobranca.id} → status: ${novoStatus}`,
    )

    // Para pagamentos confirmados, você pode querer atualizar o status do contrato
    // ou enviar recibo via WhatsApp
    if (isPago && cobranca.cliente.whatsapp) {
      const { sendTextMessage } = await import('@/lib/whatsapp')
      const valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(Number(cobranca.valor))

      await sendTextMessage(
        cobranca.cliente.whatsapp,
        `✅ Pagamento confirmado!\n\n` +
          `📋 ${cobranca.descricao}\n` +
          `💰 ${valorFormatado}\n\n` +
          `Obrigado pela confiança! 🙏\n_Equipe Volve_`,
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Webhook Asaas]', err)
    // Retorna 200 para Asaas não retentar
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
