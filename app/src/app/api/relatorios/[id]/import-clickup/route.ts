import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { importClickUpTasksForReport } from '@/lib/client-reports'

function humanError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('FIELD_605') || message.includes('Custom Field ClickApp')) {
    return 'O ClickUp recusou Custom Fields nesta lista/espaço. A rotina continuará sem campos personalizados.'
  }
  return 'Nao foi possivel importar tarefas do ClickUp agora.'
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  try {
    const result = await importClickUpTasksForReport(params.id, body?.listId ? String(body.listId) : null)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[POST /api/relatorios/import-clickup]', error)
    return NextResponse.json({ success: false, error: humanError(error) }, { status: 500 })
  }
}
