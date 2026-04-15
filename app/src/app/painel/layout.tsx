'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/painel',           label: 'Dashboard',   icon: '🏠' },
  { href: '/painel/clientes',  label: 'Clientes',    icon: '👥' },
  { href: '/painel/servicos',  label: 'Serviços',    icon: '📦' },
  { href: '/painel/aprovacoes',label: 'Aprovações',  icon: '✅' },
  { href: '/painel/propostas', label: 'Propostas',   icon: '📄' },
  { href: '/painel/contratos', label: 'Contratos',   icon: '📝' },
  { href: '/painel/cobrancas', label: 'Cobranças',   icon: '💰' },
]

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 transform bg-volve-950 text-white
          transition-transform duration-200 lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex h-16 items-center px-6 border-b border-volve-800">
          <span className="text-2xl font-bold tracking-tight">VOLVE</span>
          <span className="ml-2 text-xs text-volve-400">painel</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/painel'
                ? pathname === '/painel'
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm
                  font-medium transition-colors
                  ${isActive
                    ? 'bg-volve-800 text-white'
                    : 'text-volve-300 hover:bg-volve-900 hover:text-white'
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Usuário */}
        <div className="border-t border-volve-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-volve-700 text-sm font-bold">
              {session?.user?.nome?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">
                {session?.user?.nome}
              </p>
              <p className="text-xs text-volve-400 truncate">
                {session?.user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="w-full rounded-lg py-2 text-xs text-volve-400
                       hover:text-white hover:bg-volve-900 transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 bg-white border-b border-gray-200 px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            ☰
          </button>
          <span className="font-bold text-volve-800">VOLVE</span>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
