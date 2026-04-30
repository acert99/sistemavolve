import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { monthSlotsMonWedFri, newBatchId, slugifyClientName, validateMonthRef } from '@/lib/content-calendar-ideas'
import { findClickUpListForClient } from '@/lib/client-reports'

type ClickUpTask = {
  id: string
  name: string
  due_date?: string | null
}

async function fetchClickUpListTasks(listId: string): Promise<ClickUpTask[]> {
  const token = process.env.CLICKUP_API_TOKEN ?? process.env.CLICKUP_API_KEY
  if (!token) throw new Error('[ClickUp] CLICKUP_API_TOKEN/CLICKUP_API_KEY nao configurado')
  const tasks: ClickUpTask[] = []
  let page = 0
  while (true) {
    const url = new URL(`https://api.clickup.com/api/v2/list/${listId}/task`)
    url.searchParams.set('archived', 'false')
    url.searchParams.set('include_closed', 'true')
    url.searchParams.set('subtasks', 'true')
    url.searchParams.set('page', String(page))
    const response = await fetch(url.toString(), {
      headers: { Authorization: token },
      cache: 'no-store',
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`[ClickUp] list/${listId}/task falhou: ${text}`)
    }
    const data = (await response.json()) as { tasks?: ClickUpTask[]; last_page?: boolean }
    const batch = data.tasks ?? []
    tasks.push(...batch)
    if (data.last_page || batch.length < 100) break
    page += 1
  }
  return tasks
}

function monthBounds(monthRef: string) {
  const [y, m] = monthRef.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59))
  return { start, end }
}

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') return unauthorized()

  const { searchParams } = new URL(request.url)
  const clientId = String(searchParams.get('clientId') ?? '').trim()
  const monthRef = String(searchParams.get('month') ?? '').trim()
  const batchId = searchParams.get('batchId') ? String(searchParams.get('batchId')) : undefined

  if (!clientId || !monthRef) {
    return NextResponse.json({ success: false, error: 'clientId e month sao obrigatorios' }, { status: 400 })
  }
  validateMonthRef(monthRef)

  const ideas = await prisma.contentCalendarIdea.findMany({
    where: {
      clientId,
      monthRef,
      ...(batchId ? { batchId } : {}),
    },
    orderBy: [{ dayRef: 'asc' }, { createdAt: 'asc' }],
    take: 500,
  })

  return NextResponse.json({ success: true, data: ideas })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') return unauthorized()

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })

  const clientId = String(body.clientId ?? '').trim()
  const monthRef = String(body.month ?? '').trim()
  const mode = body.mode === 'new_batch' ? 'new_batch' : 'replace_pending'

  if (!clientId || !monthRef) {
    return NextResponse.json({ success: false, error: 'clientId e month sao obrigatorios' }, { status: 400 })
  }
  validateMonthRef(monthRef)

  const client = await prisma.cliente.findUnique({ where: { id: clientId }, select: { id: true, nome: true } })
  if (!client) return NextResponse.json({ success: false, error: 'Cliente nao encontrado' }, { status: 404 })

  const clientSlug = slugifyClientName(client.nome)

  const batchId = mode === 'new_batch' ? newBatchId() : null

  if (mode === 'replace_pending') {
    await prisma.contentCalendarIdea.deleteMany({
      where: { clientId, monthRef, status: 'pending' },
    })
  }

  const slots = monthSlotsMonWedFri(monthRef)

  // 1) Fixas (ClickUp): tasks com due_date no mês alvo.
  const fixedDates = new Set<string>()
  let fixedCreated = 0
  const { start, end } = monthBounds(monthRef)
  try {
    const found = await findClickUpListForClient(client.nome)
    if (found?.list?.id) {
      const tasks = await fetchClickUpListTasks(found.list.id)
      const fixed = tasks
        .map((t) => {
          const ms = t.due_date ? Number(t.due_date) : NaN
          const due = Number.isFinite(ms) ? new Date(ms) : null
          if (!due) return null
          if (due < start || due > end) return null
          const date = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()))
          const yyyy = date.getUTCFullYear()
          const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
          const dd = String(date.getUTCDate()).padStart(2, '0')
          const iso = `${yyyy}-${mm}-${dd}`
          return { iso, task: t }
        })
        .filter(Boolean) as Array<{ iso: string; task: ClickUpTask }>

      fixed.forEach((f) => fixedDates.add(f.iso))

      const createdFixed = await prisma.contentCalendarIdea.createMany({
        data: fixed.map((f) => ({
          clientId,
          clientSlug,
          monthRef,
          dayRef: new Date(`${f.iso}T00:00:00`),
          batchId: batchId ?? undefined,
          source: 'clickup',
          status: 'approved',
          clickupTaskId: f.task.id,
          theme: f.task.name || null,
          hook: null,
          format: null,
          cta: null,
        })),
        skipDuplicates: true,
      })
      fixedCreated = createdFixed.count
    }
  } catch (err) {
    console.warn('[POST /api/calendario-conteudo/ideias] ClickUp sync falhou:', err)
  }

  // 2) Ideias geradas: preencher slots Seg/Qua/Sex que não estão ocupados por fixas
  const toCreate = slots
    .filter((slot) => !fixedDates.has(slot.date))
    .map((slot) => ({
      clientId,
      clientSlug,
      monthRef,
      dayRef: new Date(`${slot.date}T00:00:00`),
      batchId: batchId ?? undefined,
      source: 'generated' as const,
      status: 'pending' as const,
      theme: 'a definir',
      hook: 'a definir',
      format: 'a definir',
      cta: 'a definir',
    }))

  const created = await prisma.contentCalendarIdea.createMany({ data: toCreate })
  return NextResponse.json({ success: true, data: { created: created.count, fixedCreated, batchId, clientSlug } }, { status: 201 })
}
