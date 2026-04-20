import { formatDateInAppTimeZone } from '@/lib/timezone'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME ?? 'volve'
const APP_URL =
  process.env.NEXT_PUBLIC_VPS_API_URL ??
  process.env.NEXTAUTH_URL ??
  null
const WEBHOOK_SECRET =
  process.env.EVOLUTION_WEBHOOK_SECRET ??
  process.env.CRON_SECRET ??
  null

export interface InstanceStatus {
  connected: boolean
  status: 'connected' | 'disconnected' | 'awaiting_qr' | 'error' | 'unknown'
  rawState: string
  phoneNumber: string | null
  lastConnectionAt: string | null
  lastError: string | null
}

export interface SendTextMessageResult {
  ok: boolean
  messageId: string | null
  providerStatus: string | null
  remoteJid: string | null
  error: string | null
  raw: unknown
}

function headers() {
  return { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY }
}

function extractPhoneNumber(value?: string | null) {
  if (!value) return null

  const digits = value.replace(/\D/g, '')
  return digits || null
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function normalizeStatus(state: string): InstanceStatus['status'] {
  const s = state.toLowerCase().trim()
  if (['open', 'connected'].includes(s)) return 'connected'
  if (['connecting', 'qr', 'qrcode', 'pending'].includes(s)) return 'awaiting_qr'
  if (['close', 'closed', 'disconnect', 'disconnected', 'logout'].includes(s)) return 'disconnected'
  if (['error', 'exception', 'failed'].includes(s)) return 'error'
  return 'unknown'
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchInstanceMetadata() {
  try {
    const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
      headers: headers(),
      cache: 'no-store',
    })

    if (!res.ok) return null

    const data = await res.json()
    const instances = Array.isArray(data) ? data : []
    const instance = instances.find((item) => item?.name === INSTANCE_NAME || item?.instanceName === INSTANCE_NAME)

    if (!instance) return null

    return {
      phoneNumber:
        extractPhoneNumber(instance.number) ??
        extractPhoneNumber(instance.ownerJid) ??
        null,
      lastConnectionAt: instance.updatedAt ?? instance.createdAt ?? null,
      rawState: instance.connectionStatus ?? null,
    }
  } catch {
    return null
  }
}

export async function getInstanceStatus(): Promise<InstanceStatus> {
  try {
    const res = await fetch(`${EVOLUTION_URL}/instance/connectionState/${INSTANCE_NAME}`, {
      headers: headers(),
      cache: 'no-store',
    })

    if (!res.ok) {
      return {
        connected: false,
        status: 'error',
        rawState: `http_${res.status}`,
        phoneNumber: null,
        lastConnectionAt: null,
        lastError: `Evolution respondeu ${res.status}`,
      }
    }

    const data = await res.json()
    const state = data?.instance?.state ?? data?.state ?? data?.status ?? 'unknown'
    const normalized = normalizeStatus(String(state))
    const metadata = await fetchInstanceMetadata()

    return {
      connected: normalized === 'connected',
      status: normalized,
      rawState: String(metadata?.rawState ?? state),
      phoneNumber:
        extractPhoneNumber(data?.instance?.owner) ??
        extractPhoneNumber(data?.instance?.number) ??
        extractPhoneNumber(data?.phone) ??
        metadata?.phoneNumber ??
        null,
      lastConnectionAt: data?.instance?.lastConnection ?? data?.lastConnectionAt ?? metadata?.lastConnectionAt ?? null,
      lastError: data?.error ?? null,
    }
  } catch (err) {
    return {
      connected: false,
      status: 'error',
      rawState: 'exception',
      phoneNumber: null,
      lastConnectionAt: null,
      lastError: err instanceof Error ? err.message : 'Falha ao consultar Evolution',
    }
  }
}

async function deleteInstance(): Promise<void> {
  try {
    await fetch(`${EVOLUTION_URL}/instance/delete/${INSTANCE_NAME}`, {
      method: 'DELETE',
      headers: headers(),
    })
  } catch {
    // ignora — pode não existir
  }
}

async function createInstance(): Promise<boolean> {
  try {
    const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        instanceName: INSTANCE_NAME,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function fetchQrCode(): Promise<string | null> {
  try {
    const res = await fetch(`${EVOLUTION_URL}/instance/connect/${INSTANCE_NAME}`, {
      headers: headers(),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    const qr = data?.base64 ?? data?.qrcode?.base64 ?? data?.code ?? null
    // count > 0 confirma que o QR foi gerado
    if (qr && data?.count > 0) return qr
    return null
  } catch {
    return null
  }
}

function getWebhookUrl() {
  if (!APP_URL) return null
  return `${trimTrailingSlash(APP_URL)}/api/webhooks/evolution`
}

export async function ensureInstanceWebhookConfigured(): Promise<{
  ok: boolean
  error: string | null
}> {
  const webhookUrl = getWebhookUrl()

  if (!webhookUrl) {
    return { ok: false, error: 'URL publica da aplicacao nao configurada' }
  }

  if (!WEBHOOK_SECRET) {
    return { ok: false, error: 'Segredo do webhook da Evolution nao configurado' }
  }

  try {
    const instances = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM evolution."Instance"
      WHERE name = ${INSTANCE_NAME}
      LIMIT 1
    `)

    const instanceId = instances[0]?.id
    if (!instanceId) {
      return { ok: false, error: 'Instancia da Evolution ainda nao encontrada no banco' }
    }

    const events = JSON.stringify(['SEND_MESSAGE', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'])
    const requestHeaders = JSON.stringify({ 'x-webhook-token': WEBHOOK_SECRET })

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO evolution."Webhook" (
        id,
        url,
        enabled,
        events,
        "webhookByEvents",
        "webhookBase64",
        "createdAt",
        "updatedAt",
        "instanceId",
        headers
      )
      VALUES (
        ${`${INSTANCE_NAME}-webhook`},
        ${webhookUrl},
        true,
        CAST(${events} AS jsonb),
        false,
        false,
        NOW(),
        NOW(),
        ${instanceId},
        CAST(${requestHeaders} AS jsonb)
      )
      ON CONFLICT ("instanceId") DO UPDATE SET
        url = EXCLUDED.url,
        enabled = EXCLUDED.enabled,
        events = EXCLUDED.events,
        "webhookByEvents" = EXCLUDED."webhookByEvents",
        "webhookBase64" = EXCLUDED."webhookBase64",
        headers = EXCLUDED.headers,
        "updatedAt" = NOW()
    `)

    return { ok: true, error: null }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Falha ao configurar webhook da Evolution',
    }
  }
}

// Deleta a instância antiga, recria e aguarda o QR ser gerado
export async function resetAndConnect(): Promise<{ qrcode: string | null; error: string | null }> {
  try {
    await deleteInstance()
    await sleep(1500)

    const created = await createInstance()
    if (!created) {
      return { qrcode: null, error: 'Nao foi possivel criar a instancia na Evolution API' }
    }

    const webhookResult = await ensureInstanceWebhookConfigured()

    // Aguarda o Baileys inicializar e tenta até 5 vezes com 2s de intervalo
    for (let attempt = 1; attempt <= 5; attempt++) {
      await sleep(2000)
      const qrcode = await fetchQrCode()
      if (qrcode) return { qrcode, error: null }
    }

    return {
      qrcode: null,
      error: webhookResult.ok
        ? 'QR code nao foi gerado. Verifique os logs da Evolution API e tente novamente.'
        : `Webhook configurado com erro: ${webhookResult.error}`,
    }
  } catch (err) {
    return {
      qrcode: null,
      error: err instanceof Error ? err.message : 'Erro ao iniciar conexao',
    }
  }
}

// ---------------------------------------------------------------------------
// Envio de mensagens
// ---------------------------------------------------------------------------

function formatPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export async function sendTextMessage(phone: string, text: string): Promise<SendTextMessageResult> {
  try {
    const res = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ number: formatPhone(phone), text, delay: 500 }),
    })

    if (!res.ok) {
      const details = await res.text()
      console.error('[WhatsApp] Erro ao enviar mensagem:', res.status, details)
      return {
        ok: false,
        messageId: null,
        providerStatus: null,
        remoteJid: null,
        error: `Evolution respondeu ${res.status}: ${details}`,
        raw: details,
      }
    }

    const data = await res.json().catch(() => null)

    return {
      ok: true,
      messageId: data?.key?.id ?? data?.id ?? null,
      providerStatus:
        typeof data?.status === 'string'
          ? data.status
          : typeof data?.update?.status === 'string'
            ? data.update.status
            : null,
      remoteJid: data?.key?.remoteJid ?? null,
      error: null,
      raw: data,
    }
  } catch (err) {
    console.error('[WhatsApp] Excecao ao enviar mensagem:', err)
    return {
      ok: false,
      messageId: null,
      providerStatus: null,
      remoteJid: null,
      error: err instanceof Error ? err.message : 'Falha ao enviar mensagem',
      raw: null,
    }
  }
}

export async function notificarNovaEntrega(params: {
  phone: string
  clienteNome: string
  titulo: string
  linkPortal: string
}): Promise<boolean> {
  const { phone, clienteNome, titulo, linkPortal } = params
  const result = await sendTextMessage(
    phone,
    `Ola, ${clienteNome}!\n\nSua entrega *${titulo}* esta pronta para revisao.\n\nAcesse o link abaixo para aprovar ou solicitar ajustes:\n${linkPortal}\n\n_Equipe Volve_`,
  )
  return result.ok
}

export async function notificarCobranca(params: {
  phone: string
  clienteNome: string
  descricao: string
  valor: number
  vencimento: Date
  linkPagamento: string
}): Promise<boolean> {
  const { phone, clienteNome, descricao, valor, vencimento, linkPagamento } = params
  const valorFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
  const vencFmt = formatDateInAppTimeZone(vencimento)
  const result = await sendTextMessage(
    phone,
    `Ola, ${clienteNome}!\n\nVoce tem uma cobranca disponivel:\n*${descricao}*\nValor: ${valorFmt}\nVencimento: ${vencFmt}\n\nPague com PIX, boleto ou cartao:\n${linkPagamento}\n\n_Equipe Volve_`,
  )
  return result.ok
}

export async function notificarCobrancaVencida(params: {
  phone: string
  clienteNome: string
  descricao: string
  valor: number
  diasAtraso: number
  linkPagamento: string
}): Promise<boolean> {
  const { phone, clienteNome, descricao, valor, diasAtraso, linkPagamento } = params
  const valorFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
  const result = await sendTextMessage(
    phone,
    `Ola, ${clienteNome}.\n\nSua cobranca *${descricao}* esta em aberto ha ${diasAtraso} dia(s).\nValor: ${valorFmt}\n\nPara regularizar, acesse:\n${linkPagamento}\n\nQualquer duvida, estamos a disposicao.\n_Equipe Volve_`,
  )
  return result.ok
}

export async function notificarProposta(params: {
  phone: string
  clienteNome: string
  tituloProposta: string
  valorTotal: number
  linkProposta: string
}): Promise<boolean> {
  const { phone, clienteNome, tituloProposta, valorTotal, linkProposta } = params
  const valorFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)
  const result = await sendTextMessage(
    phone,
    `Ola, ${clienteNome}!\n\nPreparamos uma proposta especial para voce:\n*${tituloProposta}*\nInvestimento: ${valorFmt}\n\nClique no link para ver os detalhes e responder:\n${linkProposta}\n\n_Equipe Volve_`,
  )
  return result.ok
}

export async function notificarContrato(params: {
  phone: string
  clienteNome: string
  tituloContrato: string
  linkAssinatura: string
}): Promise<boolean> {
  const { phone, clienteNome, tituloContrato, linkAssinatura } = params
  const result = await sendTextMessage(
    phone,
    `Ola, ${clienteNome}!\n\nSeu contrato *${tituloContrato}* esta disponivel para assinatura eletronicamente.\n\nAssine pelo link abaixo:\n${linkAssinatura}\n\n_Equipe Volve_`,
  )
  return result.ok
}
