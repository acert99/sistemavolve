import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import type {
  ClientReport,
  ClientReportItemType,
  ClientReportSource,
  ClientReportStatus,
  ClientReportType,
  Prisma,
} from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  type ClickUpTask,
  getFolderLists,
  getPortfolioFolders,
} from '@/lib/clickup'

export const REPORT_STATUSES = ['draft', 'reviewed', 'approved', 'sent'] as const
export const REPORT_TYPES = ['weekly', 'monthly'] as const

export type ReportStatus = (typeof REPORT_STATUSES)[number]
export type ReportType = (typeof REPORT_TYPES)[number]

const DELIVERED_STATUSES = new Set(['programado', 'publicado'])
const CLIENT_PENDING_STATUSES = new Set(['aguardando materiais'])
const FAILED_STATUSES = new Set(['arquivar'])
const CONTENT_TAGS = new Set(['post', 'carrossel', 'carousel', 'video', 'vídeo', 'reels', 'reel'])
const CONTENT_KEYWORDS = [
  'post',
  'carrossel',
  'carousel',
  'vídeo',
  'video',
  'reels',
  'reel',
  'feed',
  'arte',
  'criativo',
  'conteúdo',
  'conteudo',
  'campanha',
  'data comemorativa',
]
const ADMIN_KEYWORDS = ['reunião', 'reuniao', 'meeting', 'briefing', 'admin', 'interno', 'alinhamento']

export function parseDate(value: unknown) {
  if (!value || typeof value !== 'string') return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function reportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    reviewed: 'Revisado',
    approved: 'Aprovado',
    sent: 'Enviado',
  }
  return labels[status] ?? status
}

export function reportTypeLabel(type: string) {
  return type === 'monthly' ? 'Mensal' : 'Semanal'
}

export function classifyClickUpTask(task: ClickUpTask): ClientReportItemType | null {
  const status = normalizeText(task.status?.status)
  if (FAILED_STATUSES.has(status)) return null
  if (DELIVERED_STATUSES.has(status)) return 'published_content'
  if (CLIENT_PENDING_STATUSES.has(status)) return 'pending_client'
  if (status.includes('atras')) return 'delayed'
  return 'in_progress'
}

export function isContentTask(task: ClickUpTask) {
  const name = normalizeText(task.name)
  const tags = new Set((task.tags ?? []).map((tag) => normalizeText(tag.name)))
  if ([...tags].some((tag) => CONTENT_TAGS.has(tag))) return true
  if (ADMIN_KEYWORDS.some((keyword) => name.includes(keyword))) return false
  return CONTENT_KEYWORDS.some((keyword) => name.includes(normalizeText(keyword)))
}

function clickUpTaskDate(task: ClickUpTask) {
  if (!task.due_date) return null
  const date = new Date(Number(task.due_date))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function findClickUpListForClient(clientName: string, explicitListId?: string | null) {
  const portfolios = await getPortfolioFolders()
  for (const portfolio of portfolios) {
    const lists = await getFolderLists(portfolio.folderId)
    const match = explicitListId
      ? lists.find((list) => list.id === explicitListId)
      : lists.find((list) => normalizeText(list.name) === normalizeText(clientName))
    if (match) return { portfolio, list: match }
  }
  return null
}

async function fetchClickUpListTasks(listId: string) {
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
      const text = await response.text()
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

export async function importClickUpTasksForReport(reportId: string, listId?: string | null) {
  const report = await prisma.clientReport.findUnique({
    where: { id: reportId },
    include: { cliente: true },
  })
  if (!report) throw new Error('Relatorio nao encontrado')

  const target = await findClickUpListForClient(report.cliente.nome, listId)
  if (!target) {
    return { imported: 0, ignored: 0, reason: 'Lista ClickUp do cliente nao encontrada' }
  }

  const tasks = await fetchClickUpListTasks(target.list.id)
  let imported = 0
  let ignored = 0

  for (const task of tasks) {
    const dueDate = clickUpTaskDate(task)
    if (!dueDate || dueDate < report.periodStart || dueDate > report.periodEnd || !isContentTask(task)) {
      ignored += 1
      continue
    }

    const itemType = classifyClickUpTask(task)
    if (!itemType) {
      ignored += 1
      continue
    }

    const existing = await prisma.clientReportItem.findFirst({
      where: { reportId, sourceTaskId: task.id },
      select: { id: true },
    })

    const data = {
      reportId,
      type: itemType,
      title: task.name,
      description: task.description || null,
      date: dueDate,
      status: task.status?.status ?? null,
      source: 'clickup' as ClientReportSource,
      sourceTaskId: task.id,
      sourceTaskUrl: task.url,
      contentUrl: null,
    }

    if (existing) {
      await prisma.clientReportItem.update({ where: { id: existing.id }, data })
    } else {
      await prisma.clientReportItem.create({ data })
    }
    imported += 1
  }

  return { imported, ignored, listId: target.list.id, listName: target.list.name }
}

export async function calculateMonthlyComparisons(reportId: string) {
  const report = await prisma.clientReport.findUnique({
    where: { id: reportId },
    include: { metrics: true },
  })
  if (!report || report.type !== 'monthly' || !report.monthRef || !report.yearRef) return

  const previous = new Date(report.yearRef, report.monthRef - 2, 1)
  const previousReport = await prisma.clientReport.findFirst({
    where: {
      clientId: report.clientId,
      type: 'monthly',
      yearRef: previous.getFullYear(),
      monthRef: previous.getMonth() + 1,
    },
    include: { metrics: true },
  })

  const previousByKey = new Map(previousReport?.metrics.map((metric) => [metric.metricKey, metric]) ?? [])

  for (const metric of report.metrics) {
    const previousMetric = previousByKey.get(metric.metricKey)
    if (!previousMetric?.value || !metric.value) continue
    const current = Number(metric.value)
    const previousValue = Number(previousMetric.value)
    const variationAbsolute = current - previousValue
    const variationPercent = previousValue === 0 ? null : (variationAbsolute / previousValue) * 100
    await prisma.clientReportMetric.update({
      where: { id: metric.id },
      data: {
        previousValue,
        variationAbsolute,
        variationPercent,
      },
    })
  }
}

export async function consolidateMonthlyReport(reportId: string) {
  const report = await prisma.clientReport.findUnique({ where: { id: reportId } })
  if (!report || report.type !== 'monthly') throw new Error('Relatorio mensal nao encontrado')

  const monthStart = new Date(report.yearRef ?? report.periodStart.getFullYear(), (report.monthRef ?? report.periodStart.getMonth() + 1) - 1, 1)
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)

  const weeklies = await prisma.clientReport.findMany({
    where: {
      clientId: report.clientId,
      type: 'weekly',
      periodStart: { gte: monthStart },
      periodEnd: { lte: monthEnd },
    },
    include: { items: true },
    orderBy: { periodStart: 'asc' },
  })

  const items = weeklies.flatMap((weekly) => weekly.items)
  for (const item of items) {
    const existing = await prisma.clientReportItem.findFirst({
      where: {
        reportId,
        sourceTaskId: item.sourceTaskId,
        title: item.title,
      },
      select: { id: true },
    })
    if (existing) continue
    await prisma.clientReportItem.create({
      data: {
        reportId,
        type: item.type,
        title: item.title,
        description: item.description,
        date: item.date,
        status: item.status,
        source: item.source,
        sourceTaskId: item.sourceTaskId,
        sourceTaskUrl: item.sourceTaskUrl,
        contentUrl: item.contentUrl,
        orderIndex: item.orderIndex,
      },
    })
  }

  const published = items.filter((item) => item.type === 'published_content').length
  const promisedMetric = await prisma.clientReportMetric.findUnique({
    where: { reportId_metricKey: { reportId, metricKey: 'promised_posts' } },
  })
  const promised = Number(promisedMetric?.value ?? 0)
  await upsertMetric(reportId, 'published_posts', 'Posts publicados', published, 'posts', 'clickup')
  if (promised > 0) {
    await upsertMetric(reportId, 'delivery_rate_percent', 'Cumprimento de entregas', (published / promised) * 100, '%', 'clickup')
  }
  await calculateMonthlyComparisons(reportId)
  return { weeks: weeklies.length, items: items.length, published }
}

export async function upsertMetric(
  reportId: string,
  metricKey: string,
  label: string,
  value: number | null,
  unit: string | null,
  source: ClientReportSource,
  notes?: string | null,
) {
  return prisma.clientReportMetric.upsert({
    where: { reportId_metricKey: { reportId, metricKey } },
    create: { reportId, metricKey, label, value, unit, source, notes },
    update: { label, value, unit, source, notes },
  })
}

export async function updateReportStatus(report: ClientReport, status: ClientReportStatus) {
  if (status === 'sent' && report.status !== 'approved') {
    throw new Error('Apenas relatorio aprovado pode ser marcado como enviado')
  }
  if (report.status === 'sent') {
    throw new Error('Relatorio enviado nao deve ser alterado sem confirmacao')
  }
  return prisma.clientReport.update({
    where: { id: report.id },
    data: {
      status,
      reviewedAt: status === 'reviewed' ? new Date() : report.reviewedAt,
      approvedAt: status === 'approved' ? new Date() : report.approvedAt,
      sentAt: status === 'sent' ? new Date() : report.sentAt,
    },
  })
}

export function buildReportMarkdown(report: Prisma.ClientReportGetPayload<{ include: { cliente: true; metrics: true; items: true } }>) {
  const metrics = report.metrics.map((metric) => {
    const value = metric.value === null ? 'sem dados' : `${Number(metric.value).toLocaleString('pt-BR')}${metric.unit ? ` ${metric.unit}` : ''}`
    const comparison = metric.previousValue
      ? ` (anterior: ${Number(metric.previousValue).toLocaleString('pt-BR')}${metric.variationPercent ? `, variação ${Number(metric.variationPercent).toFixed(1)}%` : ''})`
      : ' (sem base anterior)'
    return `- ${metric.label}: ${value}${comparison}`
  })
  const grouped = report.items.reduce<Record<string, typeof report.items>>((acc, item) => {
    acc[item.type] = acc[item.type] ?? []
    acc[item.type].push(item)
    return acc
  }, {})

  const itemSections = Object.entries(grouped).map(([type, items]) => {
    const lines = items.map((item) => `- ${item.title}${item.status ? ` — ${item.status}` : ''}${item.contentUrl ? ` — ${item.contentUrl}` : ''}`)
    return `## ${type}\n\n${lines.join('\n')}`
  })

  return [
    `# ${report.title}`,
    '',
    `Cliente: ${report.cliente.nome}`,
    `Período: ${report.periodStart.toLocaleDateString('pt-BR')} a ${report.periodEnd.toLocaleDateString('pt-BR')}`,
    `Status: ${reportStatusLabel(report.status)}`,
    '',
    '## Resumo executivo',
    report.summary || 'Resumo ainda não preenchido.',
    '',
    '## Indicadores',
    metrics.length ? metrics.join('\n') : '- Sem métricas preenchidas.',
    '',
    '## Destaques',
    report.highlights || 'Sem destaques preenchidos.',
    '',
    '## Riscos e pontos de atenção',
    report.risks || 'Sem riscos preenchidos.',
    '',
    ...itemSections,
    '',
    '## Próximos passos',
    report.nextSteps || 'Próximos passos ainda não preenchidos.',
  ].join('\n')
}

export async function saveReportAsset(reportId: string, type: 'markdown' | 'pdf', content: Buffer | string, extension: string) {
  const folder = path.join(process.cwd(), 'public', 'generated', 'reports', reportId)
  await mkdir(folder, { recursive: true })
  const filename = `${type}-${Date.now()}.${extension}`
  const filepath = path.join(folder, filename)
  await writeFile(filepath, content)
  const publicUrl = `/generated/reports/${reportId}/${filename}`
  return prisma.clientReportAsset.create({
    data: {
      reportId,
      type,
      filename,
      path: filepath,
      publicUrl,
    },
  })
}
