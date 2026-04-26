import { NextRequest, NextResponse } from 'next/server'
import { registerLeadIncomingMessage } from '@/lib/leads'
import prisma from '@/lib/prisma'
import { safeCompareSecrets } from '@/lib/security'

const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME ?? 'volve'
const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET ?? ''

const STATUS_PRIORITY: Record<string, number> = {
  scheduled: 0,
  processing: 1,
  sent: 2,
  delivered: 3,
  read: 4,
}

const MESSAGE_EVENTS = new Set([
  'SEND_MESSAGE',
  'MESSAGES_UPDATE',
  'MESSAGES_UPSERT',
  'MESSAGE_RECEIVED',
])

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null
}

function extractPhoneNumber(value?: string | null) {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  return digits || null
}

function normalizeConnectionStatus(value: unknown): 'connected' | 'disconnected' | 'awaiting_qr' | 'error' | 'unknown' {
  const normalized = String(value ?? 'unknown').toLowerCase().trim()

  if (['open', 'connected'].includes(normalized)) return 'connected'
  if (['connecting', 'pending', 'qrcode', 'qr'].includes(normalized)) return 'awaiting_qr'
  if (['close', 'closed', 'logout', 'disconnected'].includes(normalized)) return 'disconnected'
  if (['error', 'failed', 'exception'].includes(normalized)) return 'error'
  return 'unknown'
}

function normalizeMessageStatus(value: unknown): string | null {
  if (typeof value === 'number') {
    if (value <= 0) return 'processing'
    if (value === 1) return 'sent'
    if (value === 2) return 'delivered'
    if (value >= 3) return 'read'
    return null
  }

  const normalized = String(value ?? '').toLowerCase().trim()
  if (!normalized) return null

  if (['pending', 'processing', 'queued'].includes(normalized)) return 'processing'
  if (['server_ack', 'sent'].includes(normalized)) return 'sent'
  if (['delivery_ack', 'delivered'].includes(normalized)) return 'delivered'
  if (['read', 'readself', 'played'].includes(normalized)) return 'read'
  if (['failed', 'error'].includes(normalized)) return 'failed'
  return null
}

function normalizeEventName(value: unknown) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function extractRecords(payload: Record<string, any>) {
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.messages)) return payload.messages
  if (Array.isArray(payload.message)) return payload.message
  if (isObject(payload.data)) return [payload.data]
  if (isObject(payload.message)) return [payload.message]
  if (isObject(payload)) return [payload]
  return []
}

function extractMessageId(record: Record<string, any>) {
  return (
    record.key?.id ??
    record.keyId ??
    record.data?.key?.id ??
    record.data?.keyId ??
    record.message?.key?.id ??
    record.messageId ??
    record.id ??
    null
  )
}

function extractMessageText(record: Record<string, any>) {
  return (
    record.message?.conversation ??
    record.message?.extendedTextMessage?.text ??
    record.data?.message?.conversation ??
    record.data?.message?.extendedTextMessage?.text ??
    record.text ??
    record.body ??
    'Lead respondeu no WhatsApp'
  )
}

function extractRemoteJid(record: Record<string, any>) {
  return (
    record.key?.remoteJid ??
    record.remoteJid ??
    record.data?.key?.remoteJid ??
    null
  )
}

function toBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }

  return false
}

function extractFromMe(record: Record<string, any>) {
  return toBoolean(
    record.key?.fromMe ??
      record.fromMe ??
      record.Info?.IsFromMe ??
      record.data?.key?.fromMe,
  )
}

function extractStatusCandidate(payload: Record<string, any>, record: Record<string, any>) {
  return (
    record.update?.status ??
    record.status ??
    record.data?.status ??
    record.data?.update?.status ??
    payload.status ??
    payload.state ??
    payload.data?.status ??
    payload.data?.update?.status
  )
}

async function syncChannelStatus(payload: Record<string, any>) {
  const data = isObject(payload.data) ? payload.data : payload
  const rawState =
    data.status ??
    data.state ??
    payload.state ??
    payload.status ??
    payload.event ??
    'unknown'
  const status = normalizeConnectionStatus(rawState)
  const phoneNumber =
    extractPhoneNumber(data.jid) ??
    extractPhoneNumber(data.owner) ??
    extractPhoneNumber(data.number) ??
    null

  await prisma.canalWhatsApp.upsert({
    where: {
      provider_instanceName: {
        provider: 'evolution',
        instanceName: INSTANCE_NAME,
      },
    },
    update: {
      status,
      phoneNumber: phoneNumber ?? undefined,
      lastConnectionAt: status === 'connected' ? new Date() : undefined,
      lastError: status === 'error' ? String(rawState) : null,
    },
    create: {
      provider: 'evolution',
      instanceName: INSTANCE_NAME,
      status,
      phoneNumber,
      lastConnectionAt: status === 'connected' ? new Date() : null,
      lastError: status === 'error' ? String(rawState) : null,
    },
  })
}

async function updateScheduledMessageStatus(messageId: string, nextStatus: string) {
  const mensagem = await prisma.mensagemAgendada.findFirst({
    where: { externalMessageId: messageId },
    select: {
      id: true,
      status: true,
      enviadoEm: true,
    },
  })

  if (!mensagem || mensagem.status === 'canceled') {
    return false
  }

  if (nextStatus === 'failed' && ['sent', 'delivered', 'read'].includes(mensagem.status)) {
    return false
  }

  if (mensagem.status === 'failed' || nextStatus === 'failed') {
    await prisma.mensagemAgendada.update({
      where: { id: mensagem.id },
      data: {
        status: nextStatus,
        enviadoEm:
          ['sent', 'delivered', 'read'].includes(nextStatus) && !mensagem.enviadoEm
            ? new Date()
            : undefined,
        mensagemErro: nextStatus === 'failed' ? 'Evolution marcou a mensagem com falha' : null,
      },
    })
    return true
  }

  const currentPriority = STATUS_PRIORITY[mensagem.status] ?? -1
  const nextPriority = STATUS_PRIORITY[nextStatus] ?? -1

  if (nextPriority < currentPriority) {
    return false
  }

  await prisma.mensagemAgendada.update({
    where: { id: mensagem.id },
    data: {
      status: nextStatus,
      enviadoEm:
        ['sent', 'delivered', 'read'].includes(nextStatus) && !mensagem.enviadoEm
          ? new Date()
          : undefined,
      mensagemErro: null,
    },
  })

  return true
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-webhook-token') ?? ''

  if (!WEBHOOK_SECRET || !safeCompareSecrets(token, WEBHOOK_SECRET)) {
    return NextResponse.json(
      { success: false, error: 'Nao autorizado' },
      { status: 401 },
    )
  }

  let payload: Record<string, any>

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  const event = normalizeEventName(payload.event ?? payload.type)

  try {
    if (event.includes('CONNECTION') || ['CONNECTED', 'LOGGEDOUT'].includes(event)) {
      await syncChannelStatus(payload)
      return NextResponse.json({ success: true, handled: 'connection' })
    }

    if (!MESSAGE_EVENTS.has(event)) {
      return NextResponse.json({ success: true, ignored: event || 'unknown' })
    }

    const records = extractRecords(payload)
    let updated = 0
    let inboundMatches = 0

    for (const record of records) {
      if (!isObject(record)) continue

      if (!extractFromMe(record)) {
        const remoteJid = extractRemoteJid(record)
        if (remoteJid) {
          const lead = await registerLeadIncomingMessage({
            phone: remoteJid,
            content: String(extractMessageText(record)),
            metadata: {
              event,
              record,
            },
          })

          if (lead) inboundMatches++
        }

        continue
      }

      const messageId = extractMessageId(record)
      const nextStatus = normalizeMessageStatus(extractStatusCandidate(payload, record))

      if (!messageId || !nextStatus) continue

      const changed = await updateScheduledMessageStatus(messageId, nextStatus)
      if (changed) updated++
    }

    return NextResponse.json({
      success: true,
      handled: event,
      updated,
      inboundMatches,
    })
  } catch (err) {
    console.error('[Webhook Evolution]', err)
    return NextResponse.json(
      { success: false, error: 'Erro interno no webhook da Evolution' },
      { status: 500 },
    )
  }
}
