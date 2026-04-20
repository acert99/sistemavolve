import { NextRequest, NextResponse } from 'next/server'
import { createLeadTimelineEntry, PROPOSAL_AUTO_LOST_REASON, transitionLeadStage } from '@/lib/leads'
import prisma from '@/lib/prisma'
import { sendTextMessage } from '@/lib/whatsapp'

const BATCH_SIZE = 30

async function handle(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Nao autorizado' },
      { status: 401 },
    )
  }

  const now = new Date()

  try {
    const jobs = await prisma.followUpJob.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: now },
        cancelledAt: null,
      },
      include: {
        lead: true,
      },
      orderBy: { scheduledAt: 'asc' },
      take: BATCH_SIZE,
    })

    const summary = {
      processed: 0,
      sent: 0,
      cancelled: 0,
      failed: 0,
      autoLost: 0,
    }

    for (const job of jobs) {
      summary.processed++

      if (job.lead.stage === 'won' || job.lead.stage === 'lost') {
        await prisma.followUpJob.update({
          where: { id: job.id },
          data: {
            status: 'cancelled',
            cancelledAt: now,
          },
        })
        summary.cancelled++
        continue
      }

      if (job.type === 'proposal_auto_lost_d30') {
        await transitionLeadStage({
          leadId: job.leadId,
          nextStage: 'lost',
          lostReason:
            (job.metadata as { lostReason?: string } | null)?.lostReason ??
            PROPOSAL_AUTO_LOST_REASON,
          content: 'Lead movido automaticamente para perdido por falta de resposta.',
          metadata: { jobId: job.id, automatic: true },
          force: true,
        })

        await prisma.followUpJob.update({
          where: { id: job.id },
          data: {
            status: 'sent',
            sentAt: now,
          },
        })
        summary.autoLost++
        continue
      }

      if (!job.lead.phone) {
        await prisma.followUpJob.update({
          where: { id: job.id },
          data: { status: 'failed' },
        })
        summary.failed++
        continue
      }

      const result = await sendTextMessage(job.lead.phone, job.message)

      if (!result.ok) {
        await prisma.followUpJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
          },
        })
        summary.failed++
        continue
      }

      await prisma.followUpJob.update({
        where: { id: job.id },
        data: {
          status: 'sent',
          sentAt: now,
        },
      })

      await createLeadTimelineEntry({
        leadId: job.leadId,
        type: 'wa_sent',
        content: job.message,
        metadata: {
          followUpJobId: job.id,
          providerMessageId: result.messageId,
          providerStatus: result.providerStatus,
          automatic: true,
        },
      })

      summary.sent++
    }

    return NextResponse.json({
      success: true,
      executedAt: now.toISOString(),
      ...summary,
    })
  } catch (error) {
    console.error('[Cron /api/cron/follow-up]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao processar follow-up comercial' },
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
