'use client'

import { useMemo, useState, type ReactNode, type SVGProps } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  ApprovalIcon,
  BillingIcon,
  CommercialIcon,
  ClientsIcon,
  CommunicationIcon,
  ContractIcon,
  DashboardIcon,
  LogoutIcon,
  MenuIcon,
  ProposalIcon,
  ServiceIcon,
  TasksIcon,
} from '@/components/panel/icons'

type NavItem = {
  href: string
  label: string
  description: string
  icon: (props: SVGProps<SVGSVGElement>) => ReactNode
}

const primaryNav: NavItem[] = [
  {
    href: '/painel',
    label: 'Dashboard',
    description: 'Centro de comando',
    icon: DashboardIcon,
  },
  {
    href: '/painel/clientes',
    label: 'CRM',
    description: 'Pipeline e follow-up',
    icon: ClientsIcon,
  },
  {
    href: '/painel/comercial',
    label: 'Comercial',
    description: 'Metricas e conversao',
    icon: CommercialIcon,
  },
  {
    href: '/painel/tarefas',
    label: 'Tarefas',
    description: 'Fila de atencao',
    icon: TasksIcon,
  },
  {
    href: '/painel/comunicacao',
    label: 'Comunicacao',
    description: 'WhatsApp, templates e agenda',
    icon: CommunicationIcon,
  },
  {
    href: '/painel/aprovacoes',
    label: 'Aprovacoes',
    description: 'Revisoes e feedbacks',
    icon: ApprovalIcon,
  },
  {
    href: '/painel/propostas',
    label: 'Propostas',
    description: 'Fluxo comercial ativo',
    icon: ProposalIcon,
  },
  {
    href: '/painel/contratos',
    label: 'Contratos',
    description: 'Assinaturas e pendencias',
    icon: ContractIcon,
  },
  {
    href: '/painel/cobrancas',
    label: 'Cobrancas',
    description: 'Recebimentos e alertas',
    icon: BillingIcon,
  },
]

const secondaryNav: NavItem[] = [
  {
    href: '/painel/servicos',
    label: 'Servicos',
    description: 'Catalogo e padroes',
    icon: ServiceIcon,
  },
]

function NavSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string
  items: NavItem[]
  pathname: string
  onNavigate: () => void
}) {
  return (
    <div className="space-y-2">
      <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
        {title}
      </p>
      <div className="space-y-1.5">
        {items.map((item) => {
          const isActive =
            item.href === '/painel' ? pathname === '/painel' : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200 ${
                isActive
                  ? 'bg-white text-slate-950 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.55)]'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors ${
                  isActive
                    ? 'border-slate-200 bg-slate-100 text-slate-700'
                    : 'border-white/10 bg-white/5 text-white/70 group-hover:border-white/20 group-hover:bg-white/10'
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.label}</p>
                <p className={`truncate text-xs ${isActive ? 'text-slate-500' : 'text-white/40'}`}>
                  {item.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function PainelLayout({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const activeItem = useMemo(() => {
    const allItems = [...primaryNav, ...secondaryNav]
    return allItems.find((item) =>
      item.href === '/painel' ? pathname === '/painel' : pathname.startsWith(item.href),
    )
  }, [pathname])

  return (
    <div className="min-h-screen lg:flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[308px] transform flex-col border-r border-white/10 bg-slate-950 px-5 py-5 text-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white text-lg font-semibold text-slate-950">
              V
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight">Volve</p>
              <p className="text-sm text-white/50">Plataforma interna da operacao</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/80">
              Ambiente
            </p>
            <p className="mt-1 text-sm text-white/80">Painel ativo em producao</p>
          </div>
        </div>

        <div className="mt-6 flex-1 space-y-6 overflow-y-auto pr-1">
          <NavSection
            title="Operacao"
            items={primaryNav}
            pathname={pathname}
            onNavigate={() => setSidebarOpen(false)}
          />
          <NavSection
            title="Base"
            items={secondaryNav}
            pathname={pathname}
            onNavigate={() => setSidebarOpen(false)}
          />
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white">
              {session?.user?.nome?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{session?.user?.nome ?? 'Equipe Volve'}</p>
              <p className="truncate text-xs text-white/50">{session?.user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent px-4 py-2.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogoutIcon className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-white/70 bg-slate-100/90 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-20 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white text-slate-700 shadow-sm lg:hidden"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="panel-kicker hidden sm:block">Painel Volve</p>
                <p className="truncate text-sm font-semibold text-slate-900 sm:text-base">
                  {activeItem?.label ?? 'Dashboard'}
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-white/80 bg-white px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm sm:flex">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Operacao conectada
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
          <div className="page-shell">{children}</div>
        </main>
      </div>
    </div>
  )
}
