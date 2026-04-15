// =============================================================================
// Webhook — ClickUp
// POST /api/webhooks/clickup
// Fluxo: task muda status no ClickUp → webhook → atualiza banco → WhatsApp
// Configurar em: ClickUp Settings > Integrations > Webhooks
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  validateWebhookSignature,
  mapClickUpStatus,
  getTask,
} from '@/lib/clickup'
import { notificarNovaEntrega } from '@/lib/whatsapp'

export async function POST(request: NextRequest) {
  // Lê o body como texto para validar a assinatura HMAC
  const rawBody = await request.text()

  // Valida assinatura enviada pelo ClickUp no header x-signature
  const signature = request.headers.get('x-signature') ?? ''
  if (!validateWebhookSignature(rawBody, signature)) {
    console.warn('[Webhook ClickUp] Assinatura inválida')
    return NextResponse.json(
      { success: false, error: 'Assinatura inválida' },
      { status: 401 },
    )
  }

  let payload: {
    event: string
    task_id: string
    history_items?: Array<{
      field: string
      before: { status: string }
      after: { status: string }
    }>
  }

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { event, task_id, history_items } = payload

  // Processa apenas mudanças de status
  if (event !== 'taskStatusUpdated') {
    return NextResponse.json({ success: true, message: 'Evento ignorado' })
  }

  // Extrai o novo status do ClickUp
  const statusHistoryItem = history_items?.find((h) => h.field === 'status')
  if (!statusHistoryItem) {
    return NextResponse.json({ success: true, message: 'Sem mudança de status' })
  }

  const novoStatusClickUp = statusHistoryItem.after.status
  const statusInterno = mapClickUpStatus(novoStatusClickUp)

  if (!statusInterno) {
    console.log(`[Webhook ClickUp] Status '${novoStatusClickUp}' não mapeado — ignorado`)
    return NextResponse.json({ success: true, message: 'Status não mapeado' })
  }

  try {
    // Busca entrega pelo clickup_task_id
    const entrega = await prisma.entrega.findFirst({
      where: { clickupTaskId: task_id },
      include: {
        cliente: true,
      },
    })

    if (!entrega) {
      // Task ainda não está cadastrada — cria automaticamente
      // (útil quando o ClickUp tem tasks pré-existentes)
      let taskData
      try {
        taskData = await getTask(task_id)
      } catch {
        console.warn(`[Webhook ClickUp] Task ${task_id} não encontrada no banco nem no ClickUp`)
        return NextResponse.json({ success: true })
      }

      console.log(`[Webhook ClickUp] Task ${task_id} não encontrada no banco — crie manualmente`)
      return NextResponse.json({ success: true })
    }

    // Atualiza status da entrega
    await prisma.entrega.update({
      where: { id: entrega.id },
      data: {
        status: statusInterno as any,
        updatedAt: new Date(),
      },
    })

    // Se passou para "aguardando_aprovacao", cria registro de aprovação e notifica o cliente
    if (statusInterno === 'aguardando_aprovacao') {
      // Verifica se já existe aprovação aguardando para esta entrega
      const aprovacaoExistente = await prisma.aprovacao.findFirst({
        where: {
          entregaId: entrega.id,
          status: 'aguardando',
        },
      })

      if (!aprovacaoExistente) {
        await prisma.aprovacao.create({
          data: {
            entregaId: entrega.id,
            clienteId: entrega.clienteId,
            status: 'aguardando',
          },
        })

        // Notifica cliente via WhatsApp
        if (entrega.cliente.whatsapp) {
          const linkPortal =
            `${process.env.NEXT_PUBLIC_VPS_API_URL}/cliente/aprovacoes`

          await notificarNovaEntrega({
            phone: entrega.cliente.whatsapp,
            clienteNome: entrega.cliente.nome,
            titulo: entrega.titulo,
            linkPortal,
          })
        }
      }
    }

    console.log(
      `[Webhook ClickUp] Task ${task_id} → entrega ${entrega.id} → status: ${statusInterno}`,
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Webhook ClickUp]', err)
    // Retorna 200 para o ClickUp não retentar — log o erro internamente
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 200 })
  }
}
