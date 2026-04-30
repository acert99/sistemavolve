// =============================================================================
// API — Calendario de Conteudo (MVP) — Render PDF (stub)
// GET /api/calendario-conteudo/ideias/render-pdf?clientId=...&month=YYYY-MM
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Render de PDF ainda não implementado neste MVP. (stub)',
    },
    { status: 501 },
  )
}

