import fs from 'node:fs/promises'
import path from 'node:path'
import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import { CONTENT_CALENDAR_ROOT, resolveCalendarPdfPath } from '@/lib/content-calendar'

interface RouteContext {
  params: {
    month: string
    file: string
  }
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const token = await getToken({
      req: request as never,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token || token.perfil !== 'equipe') {
      return NextResponse.json(
        { success: false, error: 'Nao autorizado' },
        { status: 403 },
      )
    }

    const filePath = resolveCalendarPdfPath(params.month, decodeURIComponent(params.file))
    const stat = await fs.lstat(filePath)

    if (stat.isSymbolicLink()) {
      return NextResponse.json(
        { success: false, error: 'Arquivo nao encontrado' },
        { status: 404 },
      )
    }

    const [rootRealPath, fileRealPath] = await Promise.all([
      fs.realpath(CONTENT_CALENDAR_ROOT),
      fs.realpath(filePath),
    ])

    if (!fileRealPath.startsWith(rootRealPath + path.sep)) {
      return NextResponse.json(
        { success: false, error: 'Arquivo nao encontrado' },
        { status: 404 },
      )
    }

    const buffer = await fs.readFile(filePath)
    const fileName = path.basename(filePath)
    const { searchParams } = new URL(request.url)
    const disposition = searchParams.get('mode') === 'view' ? 'inline' : 'attachment'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `${disposition}; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (err) {
    console.warn('[CalendarioConteudo] download falhou')
    return NextResponse.json(
      { success: false, error: 'Arquivo nao encontrado' },
      { status: 404 },
    )
  }
}
