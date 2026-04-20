'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/cliente',            label: 'Início',      icon: '🏠' },
  { href: '/cliente/aprovacoes', label: 'Aprovações',  icon: '✅' },
  { href: '/cliente/propostas',  label: 'Propostas',   icon: '📄' },
  { href: '/cliente/contratos',  label: 'Contratos',   icon: '📝' },
  { href: '/cliente/financeiro', label: 'Financeiro',  icon: '💰' },
]

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-volve-800">VOLVE</span>
            <span className="text-xs text-gray-400 hidden sm:block">Portal do Cliente</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">
              {session?.user?.nome}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Nav tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const isActive =
                item.href === '/cliente'
                  ? pathname === '/cliente'
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm
                    font-medium border-b-2 transition-colors
                    ${isActive
                      ? 'border-volve-600 text-volve-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                    }
                  `}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Conteúdo */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
