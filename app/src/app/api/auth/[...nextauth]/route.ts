// =============================================================================
// NextAuth — Autenticação com Credentials
// Perfis: equipe (→ /painel) | cliente (→ /cliente)
// =============================================================================
import NextAuth, { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  // Sessão via JWT (stateless — funciona em Edge e múltiplos servidores)
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,  // 30 dias
  },

  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Informe e-mail e senha')
        }

        // Busca usuário ativo no banco
        const usuario = await prisma.usuario.findFirst({
          where: {
            email: credentials.email.toLowerCase().trim(),
            ativo: true,
          },
        })

        if (!usuario || !usuario.senhaHash) {
          throw new Error('Credenciais inválidas')
        }

        // Verifica senha com bcrypt
        const senhaCorreta = await bcrypt.compare(
          credentials.password,
          usuario.senhaHash,
        )

        if (!senhaCorreta) {
          throw new Error('Credenciais inválidas')
        }

        // Retorna objeto User (propagado para o JWT)
        return {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil as 'equipe' | 'cliente',
          clienteId: usuario.clienteId ?? undefined,
        }
      },
    }),
  ],

  callbacks: {
    // Popula o JWT com dados extras do usuário
    async jwt({ token, user }) {
      if (user) {
        token.id       = user.id
        token.nome     = user.nome
        token.perfil   = user.perfil
        token.clienteId = user.clienteId
      }
      return token
    },

    // Popula a sessão com dados do JWT
    async session({ session, token }) {
      if (token) {
        session.user.id       = token.id as string
        session.user.nome     = token.nome as string
        session.user.perfil   = token.perfil as 'equipe' | 'cliente'
        session.user.clienteId = token.clienteId as string | undefined
      }
      return session
    },

    // Redireciona após login com base no perfil
    async redirect({ url, baseUrl, token }) {
      // Se é uma URL relativa válida
      if (url.startsWith('/')) return `${baseUrl}${url}`

      // Se a URL pertence ao mesmo domínio
      if (url.startsWith(baseUrl)) return url

      // Redireciona por perfil
      // (o token é o JWT retornado pelo callback jwt acima)
      return `${baseUrl}/auth/login`
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
