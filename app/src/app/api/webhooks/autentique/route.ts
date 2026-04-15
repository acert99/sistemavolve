// =============================================================================
// Webhook — Autentique (Assinatura Eletrônica)
// POST /api/webhooks/autentique
// Eventos: document.signed, document.viewed, signer.signed
// Configurar em: painel Autentique > Configurações > Webhooks
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validateWebhookSignature, isDocumentFullySigned } from '@/lib/autentique'
import { sendTextMessage } from '@/lib/whatsapp'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Valida assinatura HMAC-SHA256 do Autentique
  const signature = request.headers.get('x-autentique-signature') ?? ''
  const isValid = await validateWebhookSignature(rawBody, signature)

  if (!isValid) {
    console.warn('[Webhook Autentique] Assinatura inválida')
    return NextResponse.json(
      { success: false, error: 'Assinatura inválida' },
      { status: 401 },
    )
  }

  let payload: {
    event: string
    document: {
      id: string
      name: string
      status: string
      signatures: Array<{
        email: string
        signed: boolean
        signed_at: string | null
      }>
      files?: {
        signed?: string
      }
    }
  }

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { event, document: doc } = payload

  console.log(`[Webhook Autentique] Evento: ${event} | Documento: ${doc.id}`)

  try {
    // Busca o contrato pelo autentique_id
    const contrato = await prisma.contrato.findFirst({
      where: { autentiqueId: doc.id },
      include: {
        cliente: {
          select: { id: true, nome: true, email: true, whatsapp: true },
        },
      },
    })

    if (!contrato) {
      console.warn(`[Webhook Autentique] Contrato para documento ${doc.id} não encontrado`)
      return NextResponse.json({ success: true })
    }

    if (event === 'document.signed' || event === 'signer.signed') {
      // Verifica se todos os signatários assinaram
      const todosAssinaram = doc.signatures.every((sig) => sig.signed)

      if (todosAssinaram) {
        // Atualiza contrato como assinado
        await prisma.contrato.update({
          where: { id: contrato.id },
          data: {
            status: 'assinado',
            assinadoEm: new Date(),
            documentoUrl: doc.files?.signed ?? null,
          },
        })

        console.log(`[Webhook Autentique] Contrato ${contrato.id} → assinado`)

        // Notifica o time interno (via WhatsApp ou email — exemplo WhatsApp)
        // Aqui você enviaria para o número do responsável na agência
        // await sendTextMessage('5511999999999', `Contrato "${contrato.titulo}" assinado pelo cliente ${contrato.cliente.nome}!`)

        // Confirma com o cliente
        if (contrato.cliente.whatsapp) {
          await sendTextMessage(
            contrato.cliente.whatsapp,
            `✅ Contrato assinado com sucesso!\n\n` +
              `📄 *${contrato.titulo}*\n\n` +
              `Acesse o portal para baixar o documento assinado:\n` +
              `${process.env.NEXT_PUBLIC_VPS_API_URL}/cliente/contratos\n\n` +
              `_Equipe Volve_`,
          )
        }
      } else {
        // Apenas um dos signatários assinou — registra progresso
        const assinados = doc.signatures.filter((s) => s.signed).length
        const total = doc.signatures.length

        console.log(
          `[Webhook Autentique] Contrato ${contrato.id}: ${assinados}/${total} assinaturas`,
        )
      }
    }

    if (event === 'document.viewed') {
      // Opcional: registrar quando o documento foi visualizado
      console.log(`[Webhook Autentique] Documento ${doc.id} visualizado`)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Webhook Autentique]', err)
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
