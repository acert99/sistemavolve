import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import { SessionProvider } from './providers'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: {
    template: '%s | Volve',
    default: 'Volve — Plataforma da Agência',
  },
  description: 'Painel interno e portal do cliente da Volve Agência Digital',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  robots: 'noindex,nofollow',  // App interno — não indexar
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} bg-slate-100 text-slate-900 antialiased`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
