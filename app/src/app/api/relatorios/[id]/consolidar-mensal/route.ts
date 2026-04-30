import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { consolidateMonthlyReport } from '@/lib/client-reports'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'equipe') {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }
  try {
    const result = await consolidateMonthlyReport(params.id)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[POST /api/relatorios/consolidar-mensal]', error)
    return NextResponse.json({ success: false, error: 'Nao foi possivel consolidar o relatorio mensal' }, { status: 500 })
  }
}
