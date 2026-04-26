import { NextRequest, NextResponse } from 'next/server'
import { ClickUpTask, classificarTarefas } from '@/lib/clickup'

const CLICKUP_API_BASE_URL = 'https://api.clickup.com/api/v2'

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

async function fetchFolderOpenTasks(folderId: string): Promise<ClickUpTask[]> {
  const token = getClickUpToken()
  const teamId = getClickUpTeamId()

  const tasks: ClickUpTask[] = []
  let page = 0

  while (page < 10) {
    const url = new URL(`${CLICKUP_API_BASE_URL}/team/${teamId}/task`)
    url.searchParams.append('folder_ids[]', folderId)
    url.searchParams.set('include_closed', 'false')
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
}) {
  const { title, tasks, groupId, limit = 10 } = params
  const rows = tasks.filter((t) => t.groupId === groupId).slice(0, limit)
  const header = `\n*${title}* (${rows.length})`
  if (rows.length === 0) return `${header}\n- (nenhuma)`

  const lines = rows.map((task) => {
    const due = task.dueDateLabel ? ` — ${task.dueDateLabel}` : ''
    const prio = task.priorityLabel ? `(${task.priorityLabel}) ` : ''
    const client = task.clientName ? ` — ${task.clientName}` : ''
    return `- ${prio}${task.name}${client}${due}\n  ${task.url}`
  })

  return `${header}\n${lines.join('\n')}`
}

function buildTelegramMarkdown(params: {
  mode: 'morning' | 'eod'
  tasks: ReturnType<typeof classificarTarefas>
  generatedAt: Date
}) {
  const { mode, tasks, generatedAt } = params

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
    const rawTasks = (await Promise.all(folderIds.map((folderId) => fetchFolderOpenTasks(folderId))))
      .flat()
      // evita duplicacao se uma tarefa aparecer em mais de um filtro
      .reduce<ClickUpTask[]>((acc, task) => {
        if (acc.some((item) => item.id === task.id)) return acc
        acc.push(task)
        return acc
      }, [])

    const generatedAt = new Date()
    const classified = classificarTarefas(rawTasks, generatedAt)
    const markdown = buildTelegramMarkdown({ mode, tasks: classified, generatedAt })

    return NextResponse.json({
      success: true,
      mode,
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

