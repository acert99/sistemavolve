// =============================================================================
// Middleware — Proteção de rotas por perfil
// Equipe → /painel/*
// Cliente → /cliente/*
// =============================================================================
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Recupera JWT da sessão NextAuth
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // Rota pública de login
  if (pathname.startsWith('/auth/login')) {
    if (token) {
      // Usuário já logado → redireciona para área correta
      const dest = token.perfil === 'equipe' ? '/painel' : '/cliente'
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return NextResponse.next()
  }

  // Rotas públicas — propostas com token único (acessíveis sem login)
  if (pathname.startsWith('/propostas/')) {
    return NextResponse.next()
  }

  // Rotas de webhook — acesso sem autenticação JWT (validadas pelo próprio handler)
  if (pathname.startsWith('/api/webhooks/')) {
    return NextResponse.next()
  }

  // Cron jobs — validados pelo CRON_SECRET no header
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next()
  }

  // Área do painel interno — apenas equipe
  if (pathname.startsWith('/painel')) {
    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    if (token.perfil !== 'equipe') {
      return NextResponse.redirect(new URL('/cliente', request.url))
    }
    return NextResponse.next()
  }

  // Área do portal do cliente — apenas clientes
  if (pathname.startsWith('/cliente')) {
    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    if (token.perfil !== 'cliente') {
      return NextResponse.redirect(new URL('/painel', request.url))
    }
    return NextResponse.next()
  }

  // API routes protegidas — verifica autenticação básica
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 },
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/painel/:path*',
    '/cliente/:path*',
    '/auth/login',
    '/api/:path*',
    '/propostas/:path*',
  ],
}
