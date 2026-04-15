import type { Metadata } from 'next'
import './globals.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import Script from 'next/script'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? 'G-XXXXXXXXXX'
const BASE_URL = 'https://volve.com.br'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    template: '%s | Volve — Agência Digital',
    default: 'Volve — Agência Digital | Marketing, Design e Tecnologia',
  },
  description:
    'A Volve é uma agência digital especializada em marketing digital, design criativo e desenvolvimento web. Transformamos ideias em resultados reais.',
  keywords: [
    'agência digital',
    'marketing digital',
    'design gráfico',
    'desenvolvimento web',
    'tráfego pago',
    'SEO',
    'social media',
    'volve',
  ],
  authors: [{ name: 'Volve Agência Digital', url: BASE_URL }],
  creator: 'Volve Agência Digital',
  publisher: 'Volve Agência Digital',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: BASE_URL,
    siteName: 'Volve Agência Digital',
    title: 'Volve — Agência Digital | Marketing, Design e Tecnologia',
    description:
      'A Volve é uma agência digital especializada em marketing digital, design criativo e desenvolvimento web.',
    images: [
      {
        url: `${BASE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: 'Volve Agência Digital',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Volve — Agência Digital',
    description: 'Marketing, Design e Tecnologia para o seu negócio crescer.',
    images: [`${BASE_URL}/og-image.jpg`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: { canonical: BASE_URL },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION ?? '',
  },
}

// Schema.org LocalBusiness
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Volve Agência Digital',
  description:
    'Agência digital especializada em marketing digital, design criativo e desenvolvimento web.',
  url: BASE_URL,
  email: 'contato@volve.com.br',
  telephone: '+55-11-99999-9999',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'São Paulo',
    addressRegion: 'SP',
    addressCountry: 'BR',
  },
  sameAs: [
    'https://instagram.com/volve',
    'https://linkedin.com/company/volve',
  ],
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '18:00',
    },
  ],
  priceRange: '$$',
  serviceArea: {
    '@type': 'Country',
    name: 'Brasil',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Schema.org JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        {/* Google Analytics 4 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { page_path: window.location.pathname });
          `}
        </Script>

        <Header />
        {children}
        <Footer />
      </body>
    </html>
  )
}
