import { NextResponse } from 'next/server'
import { getFolderLists, getPortfolioFolders } from '@/lib/clickup'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const portfolios = await getPortfolioFolders()

    const results = await Promise.all(
      portfolios.map(async (portfolio) => {
        const lists = await getFolderLists(portfolio.folderId)
        return lists.map((list) => ({
          id: list.id,
          name: list.name,
          portfolioKey: portfolio.key,
          portfolioLabel: portfolio.label,
        }))
      }),
    )

    return NextResponse.json({ success: true, data: results.flat() })
  } catch (err) {
    console.error('[calendario-conteudo/listas]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
