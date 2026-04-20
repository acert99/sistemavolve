import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizeLeadPhone } from '@/lib/leads'
import prisma from '@/lib/prisma'
import { parseDateTimeInAppTimeZone } from '@/lib/timezone'
import type { CreateLeadPayload, LeadSource, LeadStage } from '@/types'

function parseStage(value: string | null): LeadStage | undefined {
  if (
    value === 'new' ||
    value === 'contacted' ||
    value === 'meeting' ||
    value === 'proposal' ||
    value === 'negotiation' ||
    value === 'won' ||
    value === 'lost'
  ) {
    return value
  }

  return undefined
}

function parseSource(value: string | null): LeadSource | undefined {
  if (
    value === 'indicacao' ||
    value === 'instagram' ||
    value === 'site' ||
    value === 'outro'
  ) {
    return value
  }

  return undefined
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Number(searchParams.get('limit') ?? '30'))
  const q = searchParams.get('q')?.trim() ?? ''
  const stage = parseStage(searchParams.get('stage'))
  const source = parseSource(searchParams.get('source'))
  const assignedTo = searchParams.get('assignedTo')?.trim() ?? ''
  const includeClosed = searchParams.get('includeClosed') === 'true'

  try {
    const where: Prisma.LeadWhereInput = {
      ...(includeClosed ? {} : { stage: { notIn: ['won', 'lost'] } }),
      ...(stage ? { stage } : {}),
      ...(source ? { source } : {}),
      ...(assignedTo ? { assignedTo } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { company: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { notes: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [leads, total, stageCounts] = await Promise.all([
      prisma.lead.findMany({
        where,
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
              followUpJobs: true,
              propostas: true,
            },
          },
        },
        orderBy: [{ stageChangedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
      prisma.lead.groupBy({
        by: ['stage'],
        _count: true,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: leads,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stageCounts,
      },
    })
  } catch (error) {
    console.error('[GET /api/leads]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao listar leads' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }

  let body: CreateLeadPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })
  }

  const name = body.name?.trim()
  const normalizedPhone = normalizeLeadPhone(body.phone ?? '')

  if (!name || !normalizedPhone) {
    return NextResponse.json(
      { success: false, error: 'Nome e telefone sao obrigatorios' },
      { status: 400 },
    )
  }

  const nextActionDate = body.nextActionDate
    ? parseDateTimeInAppTimeZone(body.nextActionDate)
    : null

  if (body.nextActionDate && !nextActionDate) {
    return NextResponse.json(
      { success: false, error: 'Data da proxima acao invalida' },
      { status: 400 },
    )
  }

  try {
    const existingLead = await prisma.lead.findFirst({
      where: {
        phone: normalizedPhone,
        stage: { notIn: ['won', 'lost'] },
      },
      select: { id: true, name: true, stage: true },
      orderBy: { createdAt: 'desc' },
    })

    if (existingLead) {
      return NextResponse.json(
        {
          success: false,
          error: `Ja existe um lead aberto para este telefone em ${existingLead.stage}`,
        },
        { status: 409 },
      )
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        company: body.company?.trim() || null,
        phone: normalizedPhone,
        email: body.email?.trim().toLowerCase() || null,
        instagram: body.instagram?.trim() || null,
        source: parseSource(body.source ?? null) ?? 'outro',
        referredBy: body.referredBy?.trim() || null,
        assignedTo: body.assignedTo?.trim() || session.user.id,
        servicesInterest:
          body.servicesInterest?.map((item) => item.trim()).filter(Boolean) ?? [],
        estimatedValue:
          body.estimatedValue !== undefined && body.estimatedValue !== null
            ? Number(body.estimatedValue)
            : null,
        notes: body.notes?.trim() || null,
        nextAction: body.nextAction?.trim() || null,
        nextActionDate,
      },
      include: {
        assignee: {
          select: { id: true, nome: true, email: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: lead }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/leads]', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar lead' },
      { status: 500 },
    )
  }
}
