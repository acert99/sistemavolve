import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ensureInstanceWebhookConfigured, sendTextMessage } from '@/lib/whatsapp'

const BATCH_SIZE = 20

function normalizeInitialStatus(providerStatus: string | null, messageId: string | null) {
  const normalized = providerStatus?.toLowerCase().trim() ?? ''

  if (['server_ack', 'sent'].includes(normalized)) return 'sent'
  if (['delivery_ack', 'delivered'].includes(normalized)) return 'delivered'
  if (['read', 'readself'].includes(normalized)) return 'read'
  if (['pending', 'processing', 'queued'].includes(normalized)) return 'processing'

  return messageId ? 'processing' : 'sent'
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Nao autorizado' },
      { status: 401 },
    )
  }

  try {
    const webhookSetup = await ensureInstanceWebhookConfigured()
    if (!webhookSetup.ok) {
      console.warn('[Cron /scheduled-messages] Webhook da Evolution nao confirmado:', webhookSetup.error)
    }

    const agora = new Date()
    const mensagens = await prisma.mensagemAgendada.findMany({
      where: {
        status: 'scheduled',
        agendadoPara: { lte: agora },
      },
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            whatsapp: true,
          },
        },
      },
      orderBy: { agendadoPara: 'asc' },
      take: BATCH_SIZE,
    })

    const resultados = {
      processadas: 0,
      enviadas: 0,
      emProcessamento: 0,
      falhas: 0,
      semWhatsapp: 0,
    }

    for (const mensagem of mensagens) {
      resultados.processadas++

      const whatsapp = mensagem.cliente.whatsapp?.trim()
      if (!whatsapp) {
        resultados.falhas++
        resultados.semWhatsapp++

        await prisma.mensagemAgendada.update({
          where: { id: mensagem.id },
          data: {
            status: 'failed',
            mensagemErro: 'Cliente sem WhatsApp cadastrado',
          },
        })
        continue
      }

      const result = await sendTextMessage(whatsapp, mensagem.conteudoMensagem)

      if (result.ok) {
        const initialStatus = normalizeInitialStatus(result.providerStatus, result.messageId)

        resultados.enviadas++
        if (initialStatus === 'processing') {
          resultados.emProcessamento++
        }

        await prisma.mensagemAgendada.update({
          where: { id: mensagem.id },
          data: {
            status: initialStatus,
            externalMessageId: result.messageId,
            enviadoEm: ['sent', 'delivered', 'read'].includes(initialStatus) ? new Date() : null,
            mensagemErro: null,
          },
        })
        continue
      }

      resultados.falhas++
      await prisma.mensagemAgendada.update({
        where: { id: mensagem.id },
        data: {
          status: 'failed',
          mensagemErro: result.error ?? 'Evolution API nao confirmou o envio',
        },
      })
    }

    return NextResponse.json({
      success: true,
      executadoEm: agora.toISOString(),
      ...resultados,
    })
  } catch (err) {
    console.error('[Cron /scheduled-messages]', err)
    return NextResponse.json(
      { success: false, error: 'Erro interno no executor de agendamentos' },
      { status: 500 },
    )
  }
}
