// =============================================================================
// ClickUp — Gestão de Tarefas e Webhooks
// Documentação: https://clickup.com/api
// Fluxo: ClickUp task muda status → webhook → banco → WhatsApp cliente
// =============================================================================

import crypto from 'crypto'

const CLICKUP_TOKEN   = process.env.CLICKUP_API_TOKEN!
const CLICKUP_TEAM_ID = process.env.CLICKUP_TEAM_ID!

function headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': CLICKUP_TOKEN,
  }
}

// ---------------------------------------------------------------------------
// Tipos ClickUp
// ---------------------------------------------------------------------------
export interface ClickUpTask {
  id: string
  name: string
  status: {
    status: string
    color: string
    type: string
  }
  description?: string
  url: string
  assignees: Array<{ id: number; username: string; email: string }>
  creator: { id: number; username: string; email: string }
  date_created: string
  date_updated: string
}

export interface ClickUpWebhookEvent {
  event: string          // ex: 'taskStatusUpdated'
  task_id: string
  history_items: Array<{
    field: string
    before: { status: string }
    after: { status: string }
  }>
  webhook_id: string
}

// ---------------------------------------------------------------------------
// Busca dados de uma task pelo ID
// ---------------------------------------------------------------------------
export async function getTask(taskId: string): Promise<ClickUpTask> {
  const res = await fetch(
    `https://api.clickup.com/api/v2/task/${taskId}`,
    { headers: headers() },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[ClickUp] Erro ao buscar task ${taskId}: ${err}`)
  }

  return res.json() as Promise<ClickUpTask>
}

// ---------------------------------------------------------------------------
// Atualiza o status de uma task no ClickUp
// ---------------------------------------------------------------------------
export async function updateTaskStatus(
  taskId: string,
  status: string,
): Promise<ClickUpTask> {
  const res = await fetch(
    `https://api.clickup.com/api/v2/task/${taskId}`,
    {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ status }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[ClickUp] Erro ao atualizar status da task ${taskId}: ${err}`)
  }

  return res.json() as Promise<ClickUpTask>
}

// ---------------------------------------------------------------------------
// Adiciona comentário em uma task
// ---------------------------------------------------------------------------
export async function addTaskComment(
  taskId: string,
  comment: string,
): Promise<void> {
  await fetch(
    `https://api.clickup.com/api/v2/task/${taskId}/comment`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ comment_text: comment }),
    },
  )
}

// ---------------------------------------------------------------------------
// Mapeia status do ClickUp → status interno da Plataforma Volve
// Ajuste conforme os status do seu workspace ClickUp
// ---------------------------------------------------------------------------
export function mapClickUpStatus(clickupStatus: string): string | null {
  const normalized = clickupStatus.toLowerCase().trim()

  const statusMap: Record<string, string> = {
    // Status ClickUp → StatusEntrega interno
    'em produção':             'em_producao',
    'in production':           'em_producao',
    'fazendo':                 'em_producao',
    'in progress':             'em_producao',
    'aguardando aprovação':    'aguardando_aprovacao',
    'awaiting approval':       'aguardando_aprovacao',
    'review':                  'aguardando_aprovacao',
    'em revisão':              'aguardando_aprovacao',
    'aprovado':                'aprovado',
    'approved':                'aprovado',
    'done':                    'aprovado',
    'reprovado':               'reprovado',
    'rejected':                'reprovado',
    'entregue':                'entregue',
    'delivered':               'entregue',
    'complete':                'entregue',
    'closed':                  'entregue',
  }

  return statusMap[normalized] ?? null
}

// ---------------------------------------------------------------------------
// Valida assinatura HMAC do webhook do ClickUp
// O ClickUp assina o payload com HMAC-SHA256 usando o webhook secret
// Header: x-signature
// ---------------------------------------------------------------------------
export function validateWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  const secret = process.env.CLICKUP_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[ClickUp] CLICKUP_WEBHOOK_SECRET não configurado')
    return false
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  // Comparação em tempo constante para evitar timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex'),
  )
}

// ---------------------------------------------------------------------------
// Registra um webhook no ClickUp
// Chamado uma vez durante o setup do projeto
// ---------------------------------------------------------------------------
export async function registerWebhook(
  endpointUrl: string,
  events: string[] = ['taskStatusUpdated'],
): Promise<{ id: string; webhook_id: string }> {
  const res = await fetch(
    `https://api.clickup.com/api/v2/team/${CLICKUP_TEAM_ID}/webhook`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        endpoint: endpointUrl,
        events,
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[ClickUp] Erro ao registrar webhook: ${err}`)
  }

  return res.json()
}
