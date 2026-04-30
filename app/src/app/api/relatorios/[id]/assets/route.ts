import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { buildReportMarkdown, saveReportAsset } from '@/lib/client-reports'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }
  const report = await prisma.clientReport.findUnique({
    where: { id: params.id },
    include: { cliente: true, metrics: true, items: true },
  })
  if (!report) return NextResponse.json({ success: false, error: 'Relatorio nao encontrado' }, { status: 404 })
  const markdown = buildReportMarkdown(report)
  const asset = await saveReportAsset(params.id, 'markdown', markdown, 'md')
  return NextResponse.json({ success: true, data: asset }, { status: 201 })
}
