// =============================================================================
// ClickUp — Gestão de Tarefas, Fila de Atenção e Webhooks
// Documentação: https://developer.clickup.com
// =============================================================================

import crypto from 'crypto'
import { CACHE_KEYS, deleteByPrefix, getOrSet } from '@/lib/cache'
import { formatDateInAppTimeZone, formatDateTimeInAppTimeZone } from '@/lib/timezone'
import {
  calcularDiasUteisAte,
  getAppDateKey,
  isSexta,
  labelAmanha,
} from '@/lib/utils/dates'

const CLICKUP_API_BASE_URL = 'https://api.clickup.com/api/v2'
const ACTIVE_TASK_STATUSES = [
  'a fazer social media',
  'a fazer vídeo',
  'alterar',
  'analisar',
  'backlog',
  'aguardando materiais',
  'aprovado',
  'enviar para o cliente',
] as const

export type ClickUpPortfolioKey = 'volve' | 'volve-health'
export type ClickUpTaskGroupId =
  | 'enviar_cliente'
  | 'atrasado'
  | 'hoje'
  | 'amanha'
  | 'esta_semana'
  | 'sem_prazo'
  | 'bloqueado'
  | 'aprovado'
  | 'proximas_semanas'
  | 'outros'

interface ClickUpSpace {
  id: string
  name: string
}

export interface ClickUpFolder {
  id: string
  name: string
  hidden?: boolean
}

export interface ClickUpList {
  id: string
  name: string
  folder?: { id: string; name: string }
}

export interface ClickUpPriority {
  priority: string
  color?: string | null
  orderindex?: string
}

export interface ClickUpTag {
  name: string
  tag_fg?: string | null
  tag_bg?: string | null
}

export interface ClickUpAssignee {
  id: number
  username: string
  email: string
  initials?: string | null
  color?: string | null
  profilePicture?: string | null
  profile_picture?: string | null
}

export interface ClickUpTask {
  id: string
  name: string
  status: {
    status: string
    color?: string | null
    type?: string
  }
  description?: string
  url: string
  due_date?: string | null
  priority?: ClickUpPriority | null
  assignees: ClickUpAssignee[]
  tags?: ClickUpTag[]
  creator?: { id: number; username: string; email: string }
  list?: { id: string; name: string }
  folder?: { id: string; name: string }
  space?: { id: string; name: string }
  date_created: string
  date_updated: string
}

export interface ClickUpWebhookEvent {
  event: string
  task_id: string
  history_items: Array<{
    field: string
    before: { status: string }
    after: { status: string }
  }>
  webhook_id: string
}

export interface ClickUpPortfolio {
  key: ClickUpPortfolioKey
  label: string
  folderId: string
  folderName: string
}

export interface ClickUpAttentionTask {
  id: string
  name: string
  url: string
  groupId: ClickUpTaskGroupId
  statusLabel: string
  statusColor: string | null
  dueDateLabel: string | null
  dueContextLabel: string
  dueDateIso: string | null
  businessDaysUntilDue: number | null
  priorityLabel: string | null
  priorityKey: 'urgent' | 'high' | 'normal' | 'low' | null
  assignees: Array<{
    id: string
    name: string
    initials: string
    avatarUrl: string | null
  }>
  tags: Array<{
    name: string
    backgroundColor: string | null
    textColor: string | null
  }>
  clientName: string
  portfolioName: string
  returnsOnMonday: boolean
  canSendForApproval: boolean
  updatedAtLabel: string
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function getClickUpToken() {
  const token = process.env.CLICKUP_API_TOKEN ?? process.env.CLICKUP_API_KEY
  if (!token) {
    throw new Error('[ClickUp] CLICKUP_API_TOKEN/CLICKUP_API_KEY nao configurado')
  }

  return token
}

function getClickUpTeamId() {
  const teamId = process.env.CLICKUP_TEAM_ID
  if (!teamId) {
    throw new Error('[ClickUp] CLICKUP_TEAM_ID nao configurado')
  }

  return teamId
}

function headers(additionalHeaders?: HeadersInit) {
  return {
    'Content-Type': 'application/json',
    Authorization: getClickUpToken(),
    ...(additionalHeaders ?? {}),
  }
}

async function clickUpFetch<T>(
  path: string,
  init?: RequestInit,
  searchParams?: URLSearchParams,
): Promise<T> {
  const url = new URL(`${CLICKUP_API_BASE_URL}${path}`)

  if (searchParams) {
    url.search = searchParams.toString()
  }

  const response = await fetch(url.toString(), {
    ...init,
    headers: headers(init?.headers),
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`[ClickUp] ${path} falhou: ${errorText}`)
  }

  return response.json() as Promise<T>
}

function getConfiguredEmbedUrl(portfolio: ClickUpPortfolioKey) {
  if (portfolio === 'volve') {
    return process.env.CLICKUP_PUBLIC_VIEW_URL_VOLVE ?? null
  }

  return process.env.CLICKUP_PUBLIC_VIEW_URL_VOLVE_HEALTH ?? null
}

async function getWorkflowSpaceId() {
  if (process.env.CLICKUP_SPACE_ID) {
    return process.env.CLICKUP_SPACE_ID
  }

  const teamId = getClickUpTeamId()

  const data = await getOrSet(
    CACHE_KEYS.clickupSpaces(teamId),
    () => clickUpFetch<{ spaces: ClickUpSpace[] }>(`/team/${teamId}/space`),
    60 * 30,
  )

  const workflowSpace = data.spaces.find((space) => normalizeText(space.name) === 'workflow')

  if (!workflowSpace) {
    throw new Error('[ClickUp] Space WORKFLOW nao encontrado')
  }

  return workflowSpace.id
}

function buildPortfolio(
  folders: ClickUpFolder[],
  key: ClickUpPortfolioKey,
): ClickUpPortfolio | null {
  const preferredId =
    key === 'volve'
      ? process.env.CLICKUP_FOLDER_ID_VOLVE
      : process.env.CLICKUP_FOLDER_ID_VOLVE_HEALTH

  const expectedName = key === 'volve' ? 'volve' : 'volve health'

  const folder = preferredId
    ? folders.find((item) => item.id === preferredId)
    : folders.find((item) => normalizeText(item.name) === expectedName)

  if (!folder) {
    return null
  }

  return {
    key,
    label: key === 'volve' ? 'Volve' : 'Volve Health',
    folderId: folder.id,
    folderName: folder.name,
  }
}

function parseClickUpDate(value?: string | null) {
  if (!value) return null

  const numericValue = Number(value)
  const parsed = Number.isNaN(numericValue) ? new Date(value) : new Date(numericValue)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getTaskPriorityKey(
  priority: ClickUpPriority | null | undefined,
): ClickUpAttentionTask['priorityKey'] {
  if (!priority?.priority) return null

  const normalized = normalizeText(priority.priority)

  if (normalized === 'urgent') return 'urgent'
  if (normalized === 'high') return 'high'
  if (normalized === 'normal') return 'normal'
  if (normalized === 'low') return 'low'

  return null
}

function getPriorityLabel(priorityKey: ClickUpAttentionTask['priorityKey']) {
  if (priorityKey === 'urgent') return 'Urgente'
  if (priorityKey === 'high') return 'Alta'
  if (priorityKey === 'normal') return 'Normal'
  if (priorityKey === 'low') return 'Baixa'

  return null
}

function getTaskGroup(task: ClickUpTask, referenceDate: Date) {
  const normalizedStatus = normalizeText(task.status.status)

  if (normalizedStatus === 'enviar para o cliente') return 'enviar_cliente' as const
  if (normalizedStatus === 'aguardando materiais') return 'bloqueado' as const
  if (normalizedStatus === 'aprovado') return 'aprovado' as const

  if (!task.due_date) {
    return 'sem_prazo' as const
  }

  const dueDate = parseClickUpDate(task.due_date)
  if (!dueDate) {
    return 'outros' as const
  }

  const todayKey = getAppDateKey(referenceDate)
  const dueDayKey = getAppDateKey(dueDate)

  if (dueDayKey < todayKey) {
    return 'atrasado' as const
  }

  const businessDaysUntilDue = calcularDiasUteisAte(referenceDate, dueDate)

  if (businessDaysUntilDue === 0) return 'hoje' as const
  if (businessDaysUntilDue === 1) return 'amanha' as const
  if (businessDaysUntilDue <= 5) return 'esta_semana' as const

  return 'proximas_semanas' as const
}

function buildDueContext(
  groupId: ClickUpTaskGroupId,
  dueDate: Date | null,
  referenceDate: Date,
) {
  if (!dueDate) {
    return 'Sem prazo definido'
  }

  const businessDaysUntilDue = calcularDiasUteisAte(referenceDate, dueDate)

  if (groupId === 'atrasado') {
    return `Prazo vencido em ${formatDateInAppTimeZone(dueDate)}`
  }

  if (groupId === 'hoje') {
    return 'Precisa de acao hoje'
  }

  if (groupId === 'amanha') {
    return isSexta(referenceDate)
      ? `Organizar para ${labelAmanha(referenceDate)}`
      : 'Entrega no proximo dia util'
  }

  if (groupId === 'esta_semana') {
    return `${businessDaysUntilDue} dia(s) uteis ate o prazo`
  }

  if (groupId === 'proximas_semanas') {
    return `${businessDaysUntilDue} dia(s) uteis ate o prazo`
  }

  if (groupId === 'enviar_cliente') {
    return 'Aguardando envio ou retorno do cliente'
  }

  if (groupId === 'bloqueado') {
    return 'Dependente de materiais do cliente'
  }

  if (groupId === 'aprovado') {
    return 'Pronto para publicar'
  }

  return 'Status fora do agrupamento principal'
}

function buildAssigneeName(assignee: ClickUpAssignee) {
  return assignee.username || assignee.email || `User ${assignee.id}`
}

function buildAssigneeInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) return 'CU'

  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export async function getWorkspaceFolders() {
  const spaceId = await getWorkflowSpaceId()

  const data = await getOrSet(
    CACHE_KEYS.clickupFolders(spaceId),
    () => clickUpFetch<{ folders: ClickUpFolder[] }>(`/space/${spaceId}/folder`),
    60 * 30,
  )

  return data.folders
}

export async function getPortfolioFolders() {
  const folders = await getWorkspaceFolders()

  return [buildPortfolio(folders, 'volve'), buildPortfolio(folders, 'volve-health')].filter(
    (item): item is ClickUpPortfolio => Boolean(item),
  )
}

export async function getFolderLists(folderId: string) {
  const data = await getOrSet(
    CACHE_KEYS.clickupLists(folderId),
    () => clickUpFetch<{ lists: ClickUpList[] }>(`/folder/${folderId}/list`),
    60 * 30,
  )

  return data.lists
}

export async function getActiveTasks({
  folderId,
  listId,
}: {
  folderId: string
  listId?: string | null
}) {
  const teamId = getClickUpTeamId()

  return getOrSet(
    CACHE_KEYS.clickupTasks(teamId, folderId, listId ?? null),
    async () => {
      const tasks: ClickUpTask[] = []
      let page = 0

      while (page < 10) {
        const searchParams = new URLSearchParams()

        searchParams.append('folder_ids[]', folderId)
        if (listId) {
          searchParams.append('list_ids[]', listId)
        }

        for (const status of ACTIVE_TASK_STATUSES) {
          searchParams.append('statuses[]', status)
        }

        searchParams.set('include_closed', 'false')
        searchParams.set('order_by', 'due_date')
        searchParams.set('page', String(page))

        const data = await clickUpFetch<{ tasks: ClickUpTask[] }>(
          `/team/${teamId}/task`,
          undefined,
          searchParams,
        )

        tasks.push(...(data.tasks ?? []))

        if (!data.tasks || data.tasks.length < 100) {
          break
        }

        page += 1
      }

      return tasks
    },
    60 * 2,
  )
}

export function classificarTarefas(tasks: ClickUpTask[], referenceDate: Date = new Date()) {
  return tasks.map<ClickUpAttentionTask>((task) => {
    const dueDate = parseClickUpDate(task.due_date)
    const groupId = getTaskGroup(task, referenceDate)
    const priorityKey = getTaskPriorityKey(task.priority)
    const returnsOnMonday =
      Boolean(dueDate) &&
      isSexta(referenceDate) &&
      dueDate !== null &&
      [1, 2].includes(new Date(dueDate).getDay()) &&
      (groupId === 'amanha' || groupId === 'esta_semana')

    return {
      id: task.id,
      name: task.name,
      url: task.url,
      groupId,
      statusLabel: task.status.status,
      statusColor: task.status.color ?? null,
      dueDateLabel: dueDate ? formatDateInAppTimeZone(dueDate) : null,
      dueContextLabel: buildDueContext(groupId, dueDate, referenceDate),
      dueDateIso: dueDate ? dueDate.toISOString() : null,
      businessDaysUntilDue: dueDate ? calcularDiasUteisAte(referenceDate, dueDate) : null,
      priorityLabel: getPriorityLabel(priorityKey),
      priorityKey,
      assignees: task.assignees.map((assignee) => {
        const name = buildAssigneeName(assignee)

        return {
          id: String(assignee.id),
          name,
          initials: buildAssigneeInitials(name),
          avatarUrl: assignee.profilePicture ?? assignee.profile_picture ?? null,
        }
      }),
      tags: (task.tags ?? []).map((tag) => ({
        name: tag.name,
        backgroundColor: tag.tag_bg ?? null,
        textColor: tag.tag_fg ?? null,
      })),
      clientName: task.list?.name ?? 'Cliente nao identificado',
      portfolioName: task.folder?.name ?? 'Carteira nao identificada',
      returnsOnMonday,
      canSendForApproval: normalizeText(task.status.status) === 'aprovado',
      updatedAtLabel: formatDateTimeInAppTimeZone(parseClickUpDate(task.date_updated) ?? new Date()),
    }
  })
}

export function getEmbedViewUrl(portfolio: ClickUpPortfolioKey) {
  return getConfiguredEmbedUrl(portfolio)
}

export async function invalidateClickUpTaskCaches() {
  return deleteByPrefix(CACHE_KEYS.clickupTasksPrefix(getClickUpTeamId()))
}

export async function getTask(taskId: string): Promise<ClickUpTask> {
  return clickUpFetch<ClickUpTask>(`/task/${taskId}`)
}

export async function updateTaskStatus(taskId: string, status: string): Promise<ClickUpTask> {
  return clickUpFetch<ClickUpTask>(`/task/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export async function addTaskComment(taskId: string, comment: string): Promise<void> {
  await clickUpFetch(`/task/${taskId}/comment`, {
    method: 'POST',
    body: JSON.stringify({ comment_text: comment }),
  })
}

export function mapClickUpStatus(clickupStatus: string): string | null {
  const normalized = normalizeText(clickupStatus)

  const statusMap: Record<string, string> = {
    'em producao': 'em_producao',
    'in production': 'em_producao',
    fazendo: 'em_producao',
    'in progress': 'em_producao',
    analisar: 'em_producao',
    alterar: 'em_producao',
    'a fazer social media': 'em_producao',
    'a fazer video': 'em_producao',
    'aguardando aprovacao': 'aguardando_aprovacao',
    'awaiting approval': 'aguardando_aprovacao',
    review: 'aguardando_aprovacao',
    'em revisao': 'aguardando_aprovacao',
    'enviar para o cliente': 'aguardando_aprovacao',
    aprovado: 'aprovado',
    approved: 'aprovado',
    done: 'aprovado',
    reprovado: 'reprovado',
    rejected: 'reprovado',
    entregue: 'entregue',
    delivered: 'entregue',
    complete: 'entregue',
    closed: 'entregue',
  }

  return statusMap[normalized] ?? null
}

export function validateWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.CLICKUP_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[ClickUp] CLICKUP_WEBHOOK_SECRET nao configurado')
    return false
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  const signatureBuffer = Buffer.from(signature, 'hex')

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
}

export async function registerWebhook(
  endpointUrl: string,
  events: string[] = ['taskStatusUpdated'],
): Promise<{ id: string; webhook_id: string }> {
  const teamId = getClickUpTeamId()

  return clickUpFetch<{ id: string; webhook_id: string }>(`/team/${teamId}/webhook`, {
    method: 'POST',
    body: JSON.stringify({
      endpoint: endpointUrl,
      events,
    }),
  })
}
