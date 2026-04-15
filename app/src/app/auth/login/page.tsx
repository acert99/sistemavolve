'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { Metadata } from 'next'

// ---------------------------------------------------------------------------
// Página de Login — usada por equipe e clientes
// O redirecionamento pós-login é feito pelo NextAuth callback + middleware
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('E-mail ou senha incorretos.')
      return
    }

    // Busca o perfil da sessão para redirecionar corretamente
    const sessionRes = await fetch('/api/auth/session')
    const session = await sessionRes.json()

    if (session?.user?.perfil === 'equipe') {
      router.push('/painel')
    } else if (session?.user?.perfil === 'cliente') {
      router.push('/cliente')
    } else {
      router.push('/painel')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-volve-950 via-volve-900 to-volve-800 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">VOLVE</h1>
          <p className="text-volve-300 text-sm mt-1">Agência Digital</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Entrar na plataforma
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="input"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Senha
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando…
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            Problemas para acessar?{' '}
            <a href="mailto:suporte@volve.com.br" className="text-volve-600 hover:underline">
              Entre em contato
            </a>
          </p>
        </div>

        <p className="text-center text-xs text-volve-400 mt-6">
          © {new Date().getFullYear()} Volve Agência Digital
        </p>
      </div>
    </div>
  )
}
