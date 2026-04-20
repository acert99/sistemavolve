import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
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

        const usuario = await prisma.usuario.findFirst({
          where: {
            email: credentials.email.toLowerCase().trim(),
            ativo: true,
          },
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

  secret: process.env.NEXTAUTH_SECRET,
}
