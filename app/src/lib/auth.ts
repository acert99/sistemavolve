import { randomUUID } from 'crypto'
import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { isBlockedSession, revokeBlockedSession } from '@/lib/cache'
import { clearLoginFailures, incrementLoginFailure } from '@/lib/security'
import prisma from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
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

        const email = credentials.email.toLowerCase().trim()

        // Rate limiting: bloqueia após LOGIN_FAIL_LIMIT tentativas falhadas (15 min)
        const blocked = await incrementLoginFailure(email)
        if (blocked) {
          throw new Error('Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.')
        }

        const usuario = await prisma.usuario.findFirst({
          where: { email, ativo: true },
        })

        if (!usuario || !usuario.senhaHash) {
          throw new Error('Credenciais invalidas')
        }

        const senhaCorreta = await bcrypt.compare(
          credentials.password,
          usuario.senhaHash,
        )

        if (!senhaCorreta) {
          throw new Error('Credenciais invalidas')
        }

        // Login bem-sucedido: zera o contador de falhas
        await clearLoginFailures(email)

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
    async jwt({ token, user }) {
      token.sessionId = typeof token.sessionId === 'string'
        ? token.sessionId
        : randomUUID()

      if (await isBlockedSession(token.sessionId)) {
        throw new Error('Token revogado')
      }

      if (user) {
        token.id = user.id
        token.nome = user.nome
        token.perfil = user.perfil
        token.clienteId = user.clienteId
      }
      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.nome = token.nome as string
        session.user.perfil = token.perfil as 'equipe' | 'cliente'
        session.user.clienteId = token.clienteId as string | undefined
      }
      return session
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (url.startsWith(baseUrl)) return url

      return `${baseUrl}/auth/login`
    },
  },

  events: {
    async signOut({ token }) {
      if (
        !token ||
        typeof token.sessionId !== 'string' ||
        typeof token.exp !== 'number'
      ) {
        return
      }

      await revokeBlockedSession(token.sessionId, token.exp)
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
}
