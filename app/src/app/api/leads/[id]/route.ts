import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizeLeadPhone } from '@/lib/leads'
import prisma from '@/lib/prisma'
import { parseDateTimeInAppTimeZone } from '@/lib/timezone'

type Params = { params: { id: string } }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
      include: {
        assignee: {
          select: { id: true, nome: true, email: true },
        },
        client: {
          select: { id: true, nome: true, email: true, whatsapp: true, ativo: true },
        },
        timeline: {
          include: {
            creator: {
              select: { id: true, nome: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        followUpJobs: {
          orderBy: { scheduledAt: 'asc' },
        },
        propostas: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead nao encontrado' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: lead })
  } catch (error) {
    console.error('[GET /api/leads/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar lead' },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  const nextActionDate =
    body.nextActionDate === undefined
      ? undefined
      : body.nextActionDate
        ? parseDateTimeInAppTimeZone(String(body.nextActionDate))
        : null

  if (body.nextActionDate && !nextActionDate) {
    return NextResponse.json(
      { success: false, error: 'Data da proxima acao invalida' },
      { status: 400 },
    )
  }

  try {
    const data: Prisma.LeadUpdateInput = {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.company !== undefined ? { company: body.company ? String(body.company).trim() : null } : {}),
      ...(body.phone !== undefined ? { phone: normalizeLeadPhone(String(body.phone)) } : {}),
      ...(body.email !== undefined ? { email: body.email ? String(body.email).trim().toLowerCase() : null } : {}),
      ...(body.instagram !== undefined ? { instagram: body.instagram ? String(body.instagram).trim() : null } : {}),
      ...(body.referredBy !== undefined ? { referredBy: body.referredBy ? String(body.referredBy).trim() : null } : {}),
      ...(body.assignedTo !== undefined ? { assignedTo: body.assignedTo ? String(body.assignedTo) : null } : {}),
      ...(body.servicesInterest !== undefined
        ? {
            servicesInterest: Array.isArray(body.servicesInterest)
              ? body.servicesInterest.map((item) => String(item).trim()).filter(Boolean)
              : [],
          }
        : {}),
      ...(body.estimatedValue !== undefined
        ? {
            estimatedValue:
              body.estimatedValue === null || body.estimatedValue === ''
                ? null
                : Number(body.estimatedValue),
          }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes).trim() : null } : {}),
      ...(body.nextAction !== undefined ? { nextAction: body.nextAction ? String(body.nextAction).trim() : null } : {}),
      ...(nextActionDate !== undefined ? { nextActionDate } : {}),
      ...(body.lostReason !== undefined ? { lostReason: body.lostReason ? String(body.lostReason).trim() : null } : {}),
    }

    const lead = await prisma.lead.update({
      where: { id: params.id },
      data,
      include: {
        assignee: {
          select: { id: true, nome: true, email: true },
        },
        client: {
          select: { id: true, nome: true, email: true, whatsapp: true, ativo: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: lead })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Lead nao encontrado' },
        { status: 404 },
      )
    }

    console.error('[PUT /api/leads/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar lead' },
      { status: 500 },
    )
  }
}
