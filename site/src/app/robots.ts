import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/painel/', '/cliente/'],
      },
    ],
    sitemap: 'https://volve.com.br/sitemap.xml',
    host: 'https://volve.com.br',
  }
}
