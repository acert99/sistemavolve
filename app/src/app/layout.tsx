import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from './providers'

export const metadata: Metadata = {
  title: {
    template: '%s | Volve',
    default: 'Volve — Plataforma da Agência',
  },
  description: 'Painel interno e portal do cliente da Volve Agência Digital',
  robots: 'noindex,nofollow',  // App interno — não indexar
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
