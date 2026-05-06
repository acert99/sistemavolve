import { NextRequest, NextResponse } from 'next/server'
import { createClickUpTask } from '@/lib/clickup'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { listId, titulo, formato, dataSugerida } = body

  if (!listId || !titulo) {
    return NextResponse.json(
      { success: false, error: 'listId e titulo são obrigatórios' },
      { status: 400 },
    )
  }

  try {
    const dueDateMs = dataSugerida ? new Date(dataSugerida).getTime() : undefined

    const task = await createClickUpTask(listId, {
      name: formato ? `[${formato}] ${titulo}` : titulo,
      description: 'Tarefa criada via Calendário de Conteúdo — sugestão de IA da plataforma Volve.',
      dueDateMs,
    })

    return NextResponse.json({ success: true, data: { taskUrl: task.url, taskId: task.id } })
  } catch (err) {
    console.error('[calendario-conteudo/ideias/aprovar]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
