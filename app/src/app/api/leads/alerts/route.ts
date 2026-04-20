import { subDays, subHours } from 'date-fns'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  const now = new Date()

  try {
    const [hotLeads, overdueActions, proposalWaiting, failedJobs] = await Promise.all([
      prisma.lead.findMany({
        where: {
          stage: 'new',
          createdAt: { lt: subHours(now, 2) },
          timeline: { none: {} },
        },
        include: {
          assignee: {
            select: { id: true, nome: true, email: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
      prisma.lead.findMany({
        where: {
          stage: { notIn: ['won', 'lost'] },
          nextActionDate: { lt: now },
        },
        include: {
          assignee: {
            select: { id: true, nome: true, email: true },
          },
        },
        orderBy: { nextActionDate: 'asc' },
        take: 20,
      }),
      prisma.lead.findMany({
        where: {
          stage: 'proposal',
          stageChangedAt: { lt: subDays(now, 1) },
        },
        include: {
          assignee: {
            select: { id: true, nome: true, email: true },
          },
          _count: {
            select: { followUpJobs: true },
          },
        },
        orderBy: { stageChangedAt: 'asc' },
        take: 20,
      }),
      prisma.followUpJob.findMany({
        where: {
          status: 'failed',
          lead: {
            stage: { notIn: ['won', 'lost'] },
          },
        },
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              stage: true,
              phone: true,
            },
          },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 20,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        hotLeads,
        overdueActions,
        proposalWaiting,
        failedJobs,
      },
      meta: {
        total:
          hotLeads.length +
          overdueActions.length +
          proposalWaiting.length +
          failedJobs.length,
      },
    })
  } catch (error) {
    console.error('[GET /api/leads/alerts]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao listar alertas comerciais' },
      { status: 500 },
    )
  }
}
