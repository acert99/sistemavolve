import { NextRequest, NextResponse } from 'next/server'
import { getPortfolioFolders, getTasksForMonth } from '@/lib/clickup'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const now = new Date()
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1))
  const listId = searchParams.get('listId') ?? null

  try {
    const portfolios = await getPortfolioFolders()

    const results = await Promise.all(
      portfolios.map(async (portfolio) => {
        const tasks = await getTasksForMonth(portfolio.folderId, year, month)
        return tasks
          .filter((task) => !listId || task.list?.id === listId)
          .map((task) => ({ ...task, _portfolio: portfolio.label }))
      }),
    )

    return NextResponse.json({ success: true, data: results.flat() })
  } catch (err) {
    console.error('[calendario-conteudo/tarefas]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
