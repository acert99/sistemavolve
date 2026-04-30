import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') return unauthorized()

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ success: false, error: 'JSON invalido' }, { status: 400 })

  const status = body.status
  if (status && !['pending', 'approved', 'rejected'].includes(status)) {
    return NextResponse.json({ success: false, error: 'Status invalido' }, { status: 400 })
  }

  const idea = await prisma.contentCalendarIdea.update({
    where: { id: params.id },
    data: {
      ...(status ? { status } : {}),
      ...(body.theme !== undefined ? { theme: String(body.theme || '').trim() || null } : {}),
      ...(body.hook !== undefined ? { hook: String(body.hook || '').trim() || null } : {}),
      ...(body.format !== undefined ? { format: String(body.format || '').trim() || null } : {}),
      ...(body.cta !== undefined ? { cta: String(body.cta || '').trim() || null } : {}),
      ...(body.notes !== undefined ? { notes: String(body.notes || '').trim() || null } : {}),
    },
  })

  return NextResponse.json({ success: true, data: idea })
}

