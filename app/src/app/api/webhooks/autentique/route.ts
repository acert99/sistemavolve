// =============================================================================
// Webhook — Autentique (Assinatura Eletrônica)
// POST /api/webhooks/autentique
// Compatível com o payload legado do projeto e com o formato atual:
//   - document.finished
//   - signature.accepted
//   - signature.viewed
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { transitionLeadStage } from '@/lib/leads'
import prisma from '@/lib/prisma'
import { getDocument, validateWebhookSignature } from '@/lib/autentique'
import { sendTextMessage } from '@/lib/whatsapp'

type LegacyDocumentPayload = {
  id: string
  name?: string
  status?: string
  signatures?: Array<{
    email?: string
    signed?: boolean
    signed_at?: string | null
  }>
  files?: {
    signed?: string
  }
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null
}

function extractEventType(payload: Record<string, any>): string {
  if (typeof payload.event === 'string') return payload.event
  if (isObject(payload.event) && typeof payload.event.type === 'string') {
    return payload.event.type
  }
  return ''
}

function extractEventData(payload: Record<string, any>): Record<string, any> | null {
  if (isObject(payload.event) && isObject(payload.event.data)) {
    return payload.event.data
  }
  return null
}

function extractEventObject(eventData: Record<string, any> | null): Record<string, any> | null {
  if (!eventData) return null
  if (isObject(eventData.object)) return eventData.object
  return eventData
}

function extractDocumentId(
  payload: Record<string, any>,
  eventObject: Record<string, any> | null,
): string | null {
  if (isObject(payload.document) && typeof payload.document.id === 'string') {
    return payload.document.id
  }
  if (eventObject && typeof eventObject.document === 'string') {
    return eventObject.document
  }
  if (eventObject?.object === 'document' && typeof eventObject.id === 'string') {
    return eventObject.id
  }
  return null
}

function extractDocument(
  payload: Record<string, any>,
  eventObject: Record<string, any> | null,
): LegacyDocumentPayload | null {
  if (isObject(payload.document)) {
    return payload.document as LegacyDocumentPayload
  }
  if (eventObject?.object === 'document') {
    return eventObject as LegacyDocumentPayload
  }
  return null
}

function allSigned(
  signatures: Array<{ signed?: boolean; signed_at?: string | null }>,
): boolean {
  return signatures.length > 0 && signatures.every((sig) => Boolean(sig.signed || sig.signed_at))
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  const signature = request.headers.get('x-autentique-signature') ?? ''
  const isValid = await validateWebhookSignature(rawBody, signature)

  if (!isValid) {
    console.warn('[Webhook Autentique] Assinatura inválida')
    return NextResponse.json(
      { success: false, error: 'Assinatura inválida' },
      { status: 401 },
    )
  }

  let payload: Record<string, any>

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const eventType = extractEventType(payload)
  const eventData = extractEventData(payload)
  const eventObject = extractEventObject(eventData)
  const documentId = extractDocumentId(payload, eventObject)

  console.log(
    `[Webhook Autentique] Evento: ${eventType || 'desconhecido'} | Documento: ${documentId ?? 'n/a'}`,
  )

  try {
    if (!documentId) {
      console.warn('[Webhook Autentique] Documento não identificado no payload')
      return NextResponse.json({ success: true })
    }

    const contrato = await prisma.contrato.findFirst({
      where: { autentiqueId: documentId },
      include: {
        cliente: {
          select: { id: true, nome: true, email: true, whatsapp: true },
        },
        proposta: {
          select: {
            id: true,
            leadId: true,
          },
        },
      },
    })

    if (!contrato) {
      console.warn(`[Webhook Autentique] Contrato para documento ${documentId} não encontrado`)
      return NextResponse.json({ success: true })
    }

    if (
      [
        'document.signed',
        'signer.signed',
        'document.finished',
        'signature.accepted',
      ].includes(eventType)
    ) {
      let doc = extractDocument(payload, eventObject)

      // No formato novo do Autentique, eventos de assinatura podem chegar
      // só com o objeto da assinatura. Buscamos o documento completo.
      if (!doc || !Array.isArray(doc.signatures)) {
        try {
          doc = await getDocument(documentId)
        } catch (err) {
          console.error(
            `[Webhook Autentique] Falha ao consultar documento ${documentId}:`,
            err,
          )
        }
      }

      const signatures = Array.isArray(doc?.signatures) ? doc.signatures : []
      const finished =
        eventType === 'document.finished' || allSigned(signatures)

      if (finished) {
        await prisma.contrato.update({
          where: { id: contrato.id },
          data: {
            status: 'assinado',
            assinadoEm: new Date(),
            documentoUrl: doc?.files?.signed ?? contrato.documentoUrl ?? null,
          },
        })

        console.log(`[Webhook Autentique] Contrato ${contrato.id} -> assinado`)

        if (contrato.proposta?.leadId) {
          await transitionLeadStage({
            leadId: contrato.proposta.leadId,
            nextStage: 'won',
            proposalId: contrato.proposta.id,
            content: 'Lead convertido apos assinatura de contrato.',
            metadata: {
              contratoId: contrato.id,
              autentiqueId: documentId,
            },
          })
        }

        if (contrato.cliente.whatsapp) {
          await sendTextMessage(
            contrato.cliente.whatsapp,
            `Contrato assinado com sucesso!\n\n` +
              `*${contrato.titulo}*\n\n` +
              `Acesse o portal para baixar o documento assinado:\n` +
              `${process.env.NEXT_PUBLIC_VPS_API_URL}/cliente/contratos\n\n` +
              `_Equipe Volve_`,
          )
        }
      } else {
        const signedCount = signatures.filter((sig) => Boolean(sig.signed || sig.signed_at)).length
        const total = signatures.length

        console.log(
          `[Webhook Autentique] Contrato ${contrato.id}: ${signedCount}/${total} assinaturas`,
        )
      }
    }

    if (['document.viewed', 'signature.viewed'].includes(eventType)) {
      console.log(`[Webhook Autentique] Documento ${documentId} visualizado`)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Webhook Autentique]', err)
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
