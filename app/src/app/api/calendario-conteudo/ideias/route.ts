import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { monthSlotsMonWedFri, newBatchId, slugifyClientName, validateMonthRef } from '@/lib/content-calendar-ideas'
import { findClickUpListForClient } from '@/lib/client-reports'
import { getISOWeek, getISOWeekYear } from 'date-fns'
import { geminiGenerateJson } from '@/lib/gemini'

type ClickUpTask = {
  id: string
  name: string
  status?: {
    status?: string
    type?: string
  }
  due_date?: string | null
  tags?: Array<{ name?: string }>
}

function normalizeStatus(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function isOpenTask(task: ClickUpTask) {
  const type = normalizeStatus(task.status?.type)
  const status = normalizeStatus(task.status?.status)
  if (type === 'closed') return false
  if (status === 'publicado') return false
  return true
}

function weekKey(date: Date) {
  const year = getISOWeekYear(date)
  const week = String(getISOWeek(date)).padStart(2, '0')
  return `${year}-W${week}`
}

type ContentFormat = 'reels' | 'carrossel'

function detectFormatFromTask(task: ClickUpTask): ContentFormat | null {
  const name = normalizeStatus(task.name)
  const tags = new Set((task.tags ?? []).map((tag) => normalizeStatus(tag.name)))
  const all = `${name} ${[...tags].join(' ')}`
  if (all.includes('reels') || all.includes('reel') || all.includes('video') || all.includes('vídeo')) {
    return 'reels'
  }
  if (all.includes('carrossel') || all.includes('carousel') || all.includes('card') || all.includes('estatico') || all.includes('estático')) {
    return 'carrossel'
  }
  return null
}

function nextFormat(previous: ContentFormat | null): ContentFormat {
  return previous === 'reels' ? 'carrossel' : 'reels'
}

async function generateIdeaWithGemini(options: {
  clientName: string
  monthRef: string
  dateIso: string
  format: ContentFormat
  existingTitles: string[]
}) {
  const prompt = `Voce esta ajudando a criar um planejamento de conteudo para o Instagram de um cliente.

CLIENTE: ${options.clientName}
DATA DO POST: ${options.dateIso} (YYYY-MM-DD)
MES: ${options.monthRef}
FORMATO OBRIGATORIO: ${options.format === 'reels' ? 'REELS (video curto)' : 'POST ESTATICO (card/carrossel)'}

JA EXISTE NA SEMANA (nao repetir o mesmo tema):
${options.existingTitles.length ? options.existingTitles.map((t) => `- ${t}`).join('\n') : '- (nenhum)'}

Gere 1 ideia completa e pratica. Responda APENAS com JSON valido com estas chaves:
{"theme":string,"hook":string,"format":string,"cta":string,"notes":string}

Regras:
- theme: tema curto e claro
- hook: primeira frase forte (curta)
- format: use exatamente "reels" ou "carrossel"
- cta: chamada para acao
- notes: roteiro/estrutura (bullet points). Para carrossel, sugerir 6-8 cards. Para reels, roteiro de 20-30s.
`

  return geminiGenerateJson<{ theme: string; hook: string; format: string; cta: string; notes: string }>({
    prompt,
    timeoutMs: 25_000,
    maxOutputTokens: 700,
  })
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
  //    Regra: max 3 ideias por semana (tarefas abertas no ClickUp + geradas).
  const fixedDates = new Set<string>()
  const fixedOpenCountByWeek = new Map<string, number>()
  const fixedOpenTitlesByWeek = new Map<string, string[]>()
  const fixedOpenFormatsByWeek = new Map<string, ContentFormat | null>()
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
          return { iso, task: t, due: date }
        })
        .filter(Boolean) as Array<{ iso: string; task: ClickUpTask; due: Date }>

      // para planejamento, so consideramos tarefas abertas (nao PUBLICADO/closed)
      const fixedOpen = fixed.filter((f) => isOpenTask(f.task))

      fixedOpen.forEach((f) => fixedDates.add(f.iso))

      // Conta por semana apenas tarefas abertas (nao closed e nao PUBLICADO)
      fixedOpen.forEach((f) => {
        const key = weekKey(f.due)
        fixedOpenCountByWeek.set(key, (fixedOpenCountByWeek.get(key) ?? 0) + 1)

        const titles = fixedOpenTitlesByWeek.get(key) ?? []
        titles.push(f.task.name)
        fixedOpenTitlesByWeek.set(key, titles)

        // tenta inferir o formato predominante a partir das tarefas existentes
        const detected = detectFormatFromTask(f.task)
        if (detected) {
          fixedOpenFormatsByWeek.set(key, detected)
        } else if (!fixedOpenFormatsByWeek.has(key)) {
          fixedOpenFormatsByWeek.set(key, null)
        }
      })

      const createdFixed = await prisma.contentCalendarIdea.createMany({
        data: fixedOpen.map((f) => ({
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

  // 2) Ideias geradas: preencher slots Seg/Qua/Sex respeitando max 3 por semana.
  //    Se ja existir 1 tarefa aberta no ClickUp na semana, gerar so mais 2, etc.
  const candidateSlots = slots
    .filter((slot) => !fixedDates.has(slot.date))
    .map((slot) => ({
      slot,
      dateObj: new Date(`${slot.date}T00:00:00Z`),
    }))

  const slotsByWeek = candidateSlots.reduce((acc, item) => {
    const key = weekKey(item.dateObj)
    const list = acc.get(key) ?? []
    list.push(item)
    acc.set(key, list)
    return acc
  }, new Map<string, Array<{ slot: { date: string }; dateObj: Date }>>())

  const toCreate: Array<{
    clientId: string
    clientSlug: string
    monthRef: string
    dayRef: Date
    batchId?: string
    source: 'generated'
    status: 'pending'
    theme: string
    hook: string
    format: string
    cta: string
    notes?: string | null
  }> = []

  for (const [week, weekSlots] of slotsByWeek.entries()) {
    const already = fixedOpenCountByWeek.get(week) ?? 0
    const remaining = Math.max(0, 3 - already)
    if (remaining === 0) continue

    weekSlots.sort((a, b) => a.slot.date.localeCompare(b.slot.date))

    // alternancia reels <-> carrossel
    let previous = fixedOpenFormatsByWeek.get(week) ?? null
    const existingTitles = fixedOpenTitlesByWeek.get(week) ?? []

    for (const item of weekSlots.slice(0, remaining)) {
      const format = nextFormat(previous)
      previous = format

      // gera conteudo real; se falhar, cai no placeholder (sem quebrar a UX)
      let generated: { theme: string; hook: string; format: string; cta: string; notes: string } | null = null
      try {
        generated = await generateIdeaWithGemini({
          clientName: client.nome,
          monthRef,
          dateIso: item.slot.date,
          format,
          existingTitles,
        })
      } catch (err) {
        console.warn('[CalendarioConteudo] Gemini falhou, usando placeholder')
      }

      toCreate.push({
        clientId,
        clientSlug,
        monthRef,
        dayRef: new Date(`${item.slot.date}T00:00:00`),
        batchId: batchId ?? undefined,
        source: 'generated',
        status: 'pending',
        theme: generated?.theme?.slice(0, 140) ?? 'a definir',
        hook: generated?.hook?.slice(0, 220) ?? 'a definir',
        format: format,
        cta: generated?.cta?.slice(0, 220) ?? 'a definir',
        notes: generated?.notes?.slice(0, 2000) ?? null,
      })
    }
  }

  const created = await prisma.contentCalendarIdea.createMany({ data: toCreate })
  return NextResponse.json({ success: true, data: { created: created.count, fixedCreated, batchId, clientSlug } }, { status: 201 })
}
