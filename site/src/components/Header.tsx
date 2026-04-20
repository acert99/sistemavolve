'use client'

import Link from 'next/link'
import { useState } from 'react'

const navLinks = [
  { href: '/',          label: 'Início' },
  { href: '/servicos',  label: 'Serviços' },
  { href: '/portfolio', label: 'Portfólio' },
  { href: '/sobre',     label: 'Sobre' },
  { href: '/contato',   label: 'Contato' },
]

export function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-2xl font-bold text-volve-700 tracking-tight">
          VOLVE
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 hover:text-volve-700 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/contato" className="btn-primary py-2 px-5 text-sm">
            Falar com a equipe
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile nav */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium text-gray-700 hover:text-volve-700"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/contato"
            onClick={() => setOpen(false)}
            className="block mt-3 btn-primary text-center py-2.5"
          >
            Falar com a equipe
          </Link>
        </div>
      )}
    </header>
  )
}
