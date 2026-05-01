import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  buildReportMarkdown,
  importClickUpTasksForReport,
  saveReportAsset,
  upsertMetric,
} from '@/lib/client-reports'

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
}

function parseDateOnly(value: string | null) {
  if (!value) return null
  // YYYY-MM-DD
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function defaultWeeklyWindowUtc() {
  // Default: last 7 full days ending yesterday (UTC). Keeps it deterministic without timezone deps.
  const today = new Date()
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1))
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 6))
  return { start, end }
}

async function handle(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) return unauthorized()

  const { searchParams } = request.nextUrl
  const clientId = searchParams.get('clientId') || undefined
  const startParam = parseDateOnly(searchParams.get('start'))
  const endParam = parseDateOnly(searchParams.get('end'))
  const typeParam = (searchParams.get('type') ?? 'weekly').toLowerCase()
  const type = typeParam === 'monthly' ? 'monthly' : 'weekly'

  const window = startParam && endParam ? { start: startParam, end: endParam } : defaultWeeklyWindowUtc()
  const periodStart = window.start
  const periodEnd = window.end

  const clients = await prisma.cliente.findMany({
    where: {
      ativo: true,
      ...(clientId ? { id: clientId } : {}),
    },
    select: { id: true, nome: true, reportProfile: true },
    orderBy: { nome: 'asc' },
  })

  const results: Array<{ clientId: string; clientName: string; reportId: string; imported: number; ignored: number }> = []

  for (const client of clients) {
    const title = `${type === 'monthly' ? 'Relatorio mensal' : 'Relatorio semanal'} — ${client.nome}`

    const existing = await prisma.clientReport.findFirst({
      where: {
        clientId: client.id,
        type,
        periodStart,
        periodEnd,
      },
      select: { id: true },
    })

    const report = existing
      ? await prisma.clientReport.update({ where: { id: existing.id }, data: { title } })
      : await prisma.clientReport.create({
          data: {
            clientId: client.id,
            type,
            periodStart,
            periodEnd,
            monthRef: periodStart.getUTCMonth() + 1,
            yearRef: periodStart.getUTCFullYear(),
            title,
          },
        })

    const importResult = await importClickUpTasksForReport(report.id)

    // Basic metrics
    const items = await prisma.clientReportItem.findMany({ where: { reportId: report.id }, select: { type: true } })
    const published = items.filter((i) => i.type === 'published_content').length
    const pendingClient = items.filter((i) => i.type === 'pending_client').length
    const delayed = items.filter((i) => i.type === 'delayed').length

    await upsertMetric(report.id, 'published_posts', 'Posts publicados', published, 'posts', 'clickup')
    await upsertMetric(report.id, 'pending_client', 'Pendências do cliente', pendingClient, 'itens', 'clickup')
    await upsertMetric(report.id, 'delayed', 'Atrasados', delayed, 'itens', 'clickup')

    const promised = client.reportProfile?.promisedFrequency
    if (typeof promised === 'number' && Number.isFinite(promised) && promised > 0) {
      await upsertMetric(report.id, 'promised_posts', 'Posts prometidos', promised, 'posts', 'manual')
      await upsertMetric(report.id, 'delivery_rate_percent', 'Cumprimento de entregas', (published / promised) * 100, '%', 'clickup')
    }

    const full = await prisma.clientReport.findUnique({
      where: { id: report.id },
      include: { cliente: true, metrics: true, items: true },
    })
    if (!full) continue
    const markdown = buildReportMarkdown(full)
    await saveReportAsset(report.id, 'markdown', markdown, 'md')

    results.push({
      clientId: client.id,
      clientName: client.nome,
      reportId: report.id,
      imported: Number(importResult.imported ?? 0),
      ignored: Number(importResult.ignored ?? 0),
    })
  }

  return NextResponse.json({
    success: true,
    type,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    totalClients: clients.length,
    results,
  })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

