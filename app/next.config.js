class NormalizeReadlinkEisdirPlugin {
  apply(compiler) {
    const patchInputFileSystem = (inputFileSystem) => {
      if (!inputFileSystem || !inputFileSystem.readlink || inputFileSystem.__volveReadlinkPatch) {
        return
      }

      const readlink = inputFileSystem.readlink.bind(inputFileSystem)
      inputFileSystem.readlink = (path, callback) => {
        readlink(path, (error, link) => {
          if (error && error.code === 'EISDIR' && error.syscall === 'readlink') {
            error.code = 'EINVAL'
            error.message = error.message.replace('EISDIR', 'EINVAL')
          }

          callback(error, link)
        })
      }
      inputFileSystem.__volveReadlinkPatch = true
    }

    patchInputFileSystem(compiler.inputFileSystem)
    compiler.hooks.compilation.tap('NormalizeReadlinkEisdirPlugin', (compilation) => {
      patchInputFileSystem(compilation.inputFileSystem)
    })
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Exposto no client (footer do painel) para identificar a versão em produção
  env: {
    NEXT_PUBLIC_APP_VERSION: require('./package.json').version,
  },

  // Remove cabeçalho que expõe tecnologia usada
  poweredByHeader: false,

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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "media-src 'none'",
              "object-src 'none'",
              "frame-ancestors 'self'",
            ].join('; '),
          },
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

  webpack(config) {
    config.plugins.push(new NormalizeReadlinkEisdirPlugin())
    return config
  },
}

module.exports = nextConfig
