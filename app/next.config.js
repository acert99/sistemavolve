/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite importar SVGs e outros assets
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },

  // Configuração de imagens (domínios externos permitidos)
  images: {
    domains: [
      'volvemkt.com',
      'app.volvemkt.com',
      'storage.googleapis.com',
      'cdn.asaas.com',
    ],
  },

  // Headers de segurança globais
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },

  // Redireciona raiz para /auth/login
  async redirects() {
    return [
      {
        source: '/',
        destination: '/auth/login',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig
