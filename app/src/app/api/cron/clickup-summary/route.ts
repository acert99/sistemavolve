import { NextRequest, NextResponse } from 'next/server'
import { ClickUpTask, classificarTarefas } from '@/lib/clickup'

const CLICKUP_API_BASE_URL = 'https://api.clickup.com/api/v2'
const META_POSTS_POR_CLIENTE = 3
const CLIENT_WEEKLY_POST_TARGET_OVERRIDES: Record<string, number> = {
  'Colégio Dom Bosco - Ipiaú': 0,
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function parseClickUpDate(value?: string | null) {
  if (!value) return null
  const numericValue = Number(value)
  const parsed = Number.isNaN(numericValue) ? new Date(value) : new Date(numericValue)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function appDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatAppDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function getWeekWindow(referenceDate: Date) {
  const current = new Date(`${appDateKey(referenceDate)}T12:00:00-03:00`)
  const day = current.getDay() || 7
  const start = new Date(current)
  start.setDate(current.getDate() - day + 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { startKey: appDateKey(start), endKey: appDateKey(end) }
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

async function fetchFolderTasks(folderId: string, options?: { includeClosed?: boolean }): Promise<ClickUpTask[]> {
  const token = getClickUpToken()
  const teamId = getClickUpTeamId()
  const includeClosed = options?.includeClosed ?? false

  const tasks: ClickUpTask[] = []
  let page = 0

  while (page < 10) {
    const url = new URL(`${CLICKUP_API_BASE_URL}/team/${teamId}/task`)
    url.searchParams.append('folder_ids[]', folderId)
    url.searchParams.set('include_closed', includeClosed ? 'true' : 'false')
    url.searchParams.set('order_by', 'due_date')
    url.searchParams.set('page', String(page))

    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const details = await response.text()
      throw new Error(`[ClickUp] /team/${teamId}/task falhou: ${details}`)
    }

    const data = (await response.json().catch(() => null)) as { tasks?: ClickUpTask[] } | null
    const pageTasks = data?.tasks ?? []
    tasks.push(...pageTasks)

    if (pageTasks.length < 100) {
      break
    }

    page += 1
  }

  return tasks
}

function pickTopLines(params: {
  title: string
  tasks: ReturnType<typeof classificarTarefas>
  groupId: string
  limit?: number
  showLinks?: boolean
}) {
  const { title, tasks, groupId, limit = 6, showLinks = false } = params
  const allRows = tasks.filter((t) => t.groupId === groupId)
  const rows = allRows.slice(0, limit)
  const header = `\n${title} (${allRows.length})`
  if (rows.length === 0) return `${header}\n- nenhuma`

  const lines = rows.map((task) => {
    const due = task.dueDateLabel ? ` — ${task.dueDateLabel}` : ''
    const prio = task.priorityLabel ? `(${task.priorityLabel}) ` : ''
    const client = task.clientName ? ` — ${task.clientName}` : ''
    const link = showLinks ? `\n  ${task.url}` : ''
    return `- ${client.replace(' — ', '')}: ${prio}${task.name}${due}${link}`
  })

  const remaining = allRows.length > rows.length ? `\n+${allRows.length - rows.length} restantes no ClickUp` : ''
  return `${header}\n${lines.join('\n')}${remaining}`
}

function buildKpiPostsMarkdown(rawTasks: ClickUpTask[], generatedAt: Date) {
  const { startKey, endKey } = getWeekWindow(generatedAt)
  const doneStatuses = new Set(['programado', 'publicado'])
  const ignoredStatuses = new Set(['arquivar'])

  const weeklyTasks = rawTasks.filter((task) => {
    const dueDate = parseClickUpDate(task.due_date)
    if (!dueDate) return false
    const key = appDateKey(dueDate)
    return key >= startKey && key <= endKey && !ignoredStatuses.has(normalizeText(task.status.status))
  })

  const clients = Array.from(
    new Set(rawTasks.map((task) => task.list?.name ?? 'Cliente nao identificado')),
  ).sort()
  const rows = clients.map((client) => {
    const tasks = weeklyTasks.filter((task) => (task.list?.name ?? 'Cliente nao identificado') === client)
    const realized = tasks.filter((task) => doneStatuses.has(normalizeText(task.status.status))).length
    const meta = CLIENT_WEEKLY_POST_TARGET_OVERRIDES[client] ?? META_POSTS_POR_CLIENTE
    return { client, realized, meta }
  }).filter((row) => row.meta > 0)

  const totalMeta = rows.reduce((sum, row) => sum + row.meta, 0)
  const totalRealized = rows.reduce((sum, row) => sum + row.realized, 0)
  const critical = rows.filter((row) => row.realized === 0)
  const attention = rows.filter((row) => row.realized > 0 && row.realized < row.meta)
  const onTrack = rows.filter((row) => row.realized >= row.meta)

  const section = (title: string, items: typeof rows) => {
    if (items.length === 0) return `${title}\n- nenhum`
    return `${title}\n${items.map((row) => `- ${row.client}: ${row.realized}/${row.meta}`).join('\n')}`
  }

  return [
    `📊 KPI de Posts — manhã`,
    '',
    `Meta semanal: ${totalMeta} posts`,
    `Realizado: ${totalRealized}/${totalMeta}`,
    `Meta por cliente: ${META_POSTS_POR_CLIENTE} posts/semana`,
    '',
    section('Crítico', critical),
    '',
    section('Atenção', attention),
    '',
    section('No ritmo', onTrack),
  ].join('\n')
}

function buildDailyBriefingMarkdown(tasks: ReturnType<typeof classificarTarefas>, generatedAt: Date) {
  return [
    `Briefing do Dia — ${formatAppDate(generatedAt)}`,
    '',
    pickTopLines({ title: 'Prioridade 1 — vencem hoje', tasks, groupId: 'hoje', limit: 6 }).replace(/^\n/, ''),
    '',
    pickTopLines({ title: 'Prioridade 2 — atrasadas', tasks, groupId: 'atrasado', limit: 6 }).replace(/^\n/, ''),
    '',
    pickTopLines({ title: 'Bloqueadas / aguardando material', tasks, groupId: 'bloqueado', limit: 6 }).replace(/^\n/, ''),
    '',
    pickTopLines({ title: 'Enviar para o cliente', tasks, groupId: 'enviar_cliente', limit: 6 }).replace(/^\n/, ''),
  ].join('\n')
}

function buildDailyClosingMarkdown(params: {
  rawTasks: ClickUpTask[]
  tasks: ReturnType<typeof classificarTarefas>
  generatedAt: Date
}) {
  const { rawTasks, tasks, generatedAt } = params
  const todayKey = appDateKey(generatedAt)
  const doneStatuses = new Set(['programado', 'publicado'])
  const updatedDoneToday = rawTasks.filter((task) => {
    const updated = parseClickUpDate(task.date_updated)
    return updated && appDateKey(updated) === todayKey && doneStatuses.has(normalizeText(task.status.status))
  })
  const today = tasks.filter((task) => task.groupId === 'hoje')
  const overdue = tasks.filter((task) => task.groupId === 'atrasado')
  const blockers = tasks.filter((task) => task.groupId === 'bloqueado')
  const tomorrow = tasks.filter((task) => task.groupId === 'amanha')

  return [
    `Fechamento do Dia — ${formatAppDate(generatedAt)}`,
    '',
    'Resumo',
    `Programadas/publicadas hoje: ${updatedDoneToday.length}`,
    `Ainda vencem hoje: ${today.length}`,
    `Atrasadas abertas: ${overdue.length}`,
    `Bloqueadas: ${blockers.length}`,
    `Risco para amanhã: ${tomorrow.length}`,
    '',
    pickTopLines({ title: 'Pendências que entram no briefing de amanhã', tasks, groupId: 'hoje', limit: 5 }).replace(/^\n/, ''),
    '',
    pickTopLines({ title: 'Riscos para amanhã', tasks, groupId: 'amanha', limit: 5 }).replace(/^\n/, ''),
    '',
    'Observação',
    'Sem ação imediata aqui. Isso entra organizado no briefing da manhã.',
  ].join('\n')
}

function buildTelegramMarkdown(params: {
  mode: 'morning' | 'eod'
  type: 'kpi' | 'briefing' | 'closing'
  rawTasks: ClickUpTask[]
  tasks: ReturnType<typeof classificarTarefas>
  generatedAt: Date
}) {
  const { mode, type, rawTasks, tasks, generatedAt } = params

  if (type === 'kpi') return buildKpiPostsMarkdown(rawTasks, generatedAt)
  if (type === 'briefing') return buildDailyBriefingMarkdown(tasks, generatedAt)
  if (type === 'closing') return buildDailyClosingMarkdown({ rawTasks, tasks, generatedAt })

  const title = mode === 'eod' ? 'ClickUp — Fechamento' : 'ClickUp — Manhã'
  const header = `${title}\nGerado em: ${generatedAt.toISOString()}`

  const sections: string[] = []

  sections.push(pickTopLines({ title: 'Atrasadas', tasks, groupId: 'atrasado' }))
  sections.push(pickTopLines({ title: 'Vencem hoje', tasks, groupId: 'hoje' }))

  if (mode === 'eod') {
    sections.push(pickTopLines({ title: 'Amanha', tasks, groupId: 'amanha' }))
  } else {
    sections.push(pickTopLines({ title: 'Amanha', tasks, groupId: 'amanha' }))
    sections.push(pickTopLines({ title: 'Esta semana', tasks, groupId: 'esta_semana' }))
    sections.push(pickTopLines({ title: 'Sem prazo', tasks, groupId: 'sem_prazo' }))
  }

  sections.push(pickTopLines({ title: 'Bloqueado', tasks, groupId: 'bloqueado' }))
  sections.push(pickTopLines({ title: 'Enviar para o cliente', tasks, groupId: 'enviar_cliente' }))

  return `${header}\n${sections.join('\n')}`
}

async function handle(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  const modeParam = (request.nextUrl.searchParams.get('mode') ?? 'morning').toLowerCase()
  const mode: 'morning' | 'eod' = modeParam === 'eod' ? 'eod' : 'morning'
  const typeParam = (request.nextUrl.searchParams.get('type') ?? '').toLowerCase()
  const type: 'kpi' | 'briefing' | 'closing' =
    typeParam === 'kpi' ? 'kpi' : typeParam === 'closing' ? 'closing' : mode === 'eod' ? 'closing' : 'briefing'

  const folderIdVolve = process.env.CLICKUP_FOLDER_ID_VOLVE
  const folderIdHealth = process.env.CLICKUP_FOLDER_ID_VOLVE_HEALTH
  const folderIds = [folderIdVolve, folderIdHealth].filter((value): value is string => Boolean(value))

  if (folderIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'CLICKUP_FOLDER_ID_VOLVE / CLICKUP_FOLDER_ID_VOLVE_HEALTH nao configurados' },
      { status: 500 },
    )
  }

  try {
    const includeClosedForKpi = type === 'kpi'
    const rawTasks = (await Promise.all(folderIds.map((folderId) => fetchFolderTasks(folderId, { includeClosed: includeClosedForKpi }))))
      .flat()
      // evita duplicacao se uma tarefa aparecer em mais de um filtro
      .reduce<ClickUpTask[]>((acc, task) => {
        if (acc.some((item) => item.id === task.id)) return acc
        acc.push(task)
        return acc
      }, [])

    const generatedAt = new Date()
    const classified = classificarTarefas(rawTasks, generatedAt)
    const markdown = buildTelegramMarkdown({ mode, type, rawTasks, tasks: classified, generatedAt })

    return NextResponse.json({
      success: true,
      mode,
      type,
      generatedAt: generatedAt.toISOString(),
      total: rawTasks.length,
      markdown,
    })
  } catch (error) {
    console.error('[Cron /api/cron/clickup-summary]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao gerar resumo do ClickUp' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
