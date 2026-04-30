import React from 'react'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { saveReportAsset } from '@/lib/client-reports'

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 10, color: '#0f172a', fontFamily: 'Helvetica' },
  cover: { padding: 32, backgroundColor: '#0f172a', color: '#ffffff', marginBottom: 24, borderRadius: 12 },
  brand: { fontSize: 12, letterSpacing: 2, marginBottom: 28, color: '#cbd5e1' },
  title: { fontSize: 28, lineHeight: 1.2, fontWeight: 700, marginBottom: 8 },
  subtitle: { fontSize: 12, color: '#e2e8f0' },
  section: { marginBottom: 18 },
  h2: { fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#111827' },
  text: { fontSize: 10, lineHeight: 1.55, color: '#334155' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '48%', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, marginBottom: 8 },
  label: { color: '#64748b', fontSize: 8, marginBottom: 4 },
  value: { fontSize: 14, fontWeight: 700 },
  item: { borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 6 },
})

function fmt(date: Date) {
  return date.toLocaleDateString('pt-BR')
}

function ReportPdf({ report }: { report: any }) {
  const metrics = report.metrics ?? []
  const items = report.items ?? []
  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      React.createElement(View, { style: styles.cover },
        React.createElement(Text, { style: styles.brand }, 'VOLVE'),
        React.createElement(Text, { style: styles.title }, report.title),
        React.createElement(Text, { style: styles.subtitle }, `${report.cliente.nome} · ${fmt(report.periodStart)} a ${fmt(report.periodEnd)}`),
      ),
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Resumo executivo'),
        React.createElement(Text, { style: styles.text }, report.summary || 'Resumo ainda não preenchido.'),
      ),
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Indicadores do mês'),
        React.createElement(View, { style: styles.grid },
          ...(metrics.length ? metrics : [{ label: 'Métricas', value: null, unit: null }]).map((metric: any) => React.createElement(View, { key: metric.id ?? metric.label, style: styles.card },
            React.createElement(Text, { style: styles.label }, metric.label),
            React.createElement(Text, { style: styles.value }, metric.value === null || metric.value === undefined ? 'sem dados' : `${Number(metric.value).toLocaleString('pt-BR')}${metric.unit ? ` ${metric.unit}` : ''}`),
          )),
        ),
      ),
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Conteúdos e operação'),
        ...(items.length ? items : [{ id: 'empty', title: 'Sem itens registrados', status: '', description: '' }]).slice(0, 18).map((item: any) => React.createElement(View, { key: item.id, style: styles.item },
          React.createElement(Text, { style: styles.text }, `${item.title}${item.status ? ` — ${item.status}` : ''}`),
          item.description ? React.createElement(Text, { style: styles.text }, item.description) : null,
        )),
      ),
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.h2 }, 'Próximos passos'),
        React.createElement(Text, { style: styles.text }, report.nextSteps || 'Próximos passos ainda não preenchidos.'),
      ),
      React.createElement(Text, { style: styles.text }, 'Equipe Volve'),
    ),
  )
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  const report = await prisma.clientReport.findUnique({ where: { id: params.id }, include: { cliente: true, metrics: true, items: true } })
  if (!report) return NextResponse.json({ success: false, error: 'Relatorio nao encontrado' }, { status: 404 })
  const buffer = await renderToBuffer(React.createElement(ReportPdf, { report }) as React.ReactElement)
  const asset = await saveReportAsset(params.id, 'pdf', buffer, 'pdf')
  return NextResponse.json({ success: true, data: asset }, { status: 201 })
}
