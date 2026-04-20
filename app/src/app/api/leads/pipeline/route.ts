import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const PIPELINE_STAGES = ['new', 'contacted', 'meeting', 'proposal', 'negotiation'] as const

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  try {
    const [leads, wonCount, lostCount, activeClients, stageCounts] = await Promise.all([
      prisma.lead.findMany({
        where: {
          stage: {
            in: [...PIPELINE_STAGES, 'won', 'lost'],
          },
        },
        include: {
          assignee: {
            select: { id: true, nome: true, email: true },
          },
          client: {
            select: { id: true, nome: true, email: true, ativo: true },
          },
          _count: {
            select: {
              timeline: true,
              propostas: true,
              followUpJobs: true,
            },
          },
        },
        orderBy: [{ stageChangedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.lead.count({ where: { stage: 'won' } }),
      prisma.lead.count({ where: { stage: 'lost' } }),
      prisma.cliente.count({ where: { ativo: true } }),
      prisma.lead.groupBy({
        by: ['stage'],
        _count: true,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        columns: PIPELINE_STAGES.map((stage) => ({
          stage,
          items: leads.filter((lead) => lead.stage === stage),
        })),
        closed: {
          won: leads.filter((lead) => lead.stage === 'won'),
          lost: leads.filter((lead) => lead.stage === 'lost'),
        },
        summary: {
          wonCount,
          lostCount,
          activeClients,
          stageCounts,
        },
      },
    })
  } catch (error) {
    console.error('[GET /api/leads/pipeline]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao montar pipeline' },
      { status: 500 },
    )
  }
}
