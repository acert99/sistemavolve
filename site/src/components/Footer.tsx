import Link from 'next/link'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-volve-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Marca */}
          <div className="md:col-span-2">
            <h2 className="text-2xl font-bold mb-3">VOLVE</h2>
            <p className="text-volve-300 text-sm leading-relaxed max-w-sm">
              Agência digital especializada em marketing, design e tecnologia.
              Transformamos ideias em resultados mensuráveis.
            </p>
            <div className="flex gap-4 mt-6">
              <a
                href="https://instagram.com/volve"
                target="_blank"
                rel="noreferrer"
                className="text-volve-400 hover:text-white transition-colors text-sm"
              >
                Instagram
              </a>
              <a
                href="https://linkedin.com/company/volve"
                target="_blank"
                rel="noreferrer"
                className="text-volve-400 hover:text-white transition-colors text-sm"
              >
                LinkedIn
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-volve-400">
              Navegação
            </h3>
            <ul className="space-y-2">
              {[
                ['/', 'Início'],
                ['/servicos', 'Serviços'],
                ['/portfolio', 'Portfólio'],
                ['/sobre', 'Sobre'],
                ['/contato', 'Contato'],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-volve-300 hover:text-white text-sm transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-volve-400">
              Contato
            </h3>
            <ul className="space-y-2 text-sm text-volve-300">
              <li>
                <a href="mailto:contato@volve.com.br" className="hover:text-white transition-colors">
                  contato@volve.com.br
                </a>
              </li>
              <li>
                <a href="https://wa.me/5511999999999" className="hover:text-white transition-colors">
                  WhatsApp
                </a>
              </li>
              <li className="pt-2">São Paulo, SP — Brasil</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-volve-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-volve-500">
            © {year} Volve Agência Digital. Todos os direitos reservados.
          </p>
          <div className="flex gap-4 text-xs text-volve-500">
            <a href="/politica-de-privacidade" className="hover:text-volve-300">
              Política de Privacidade
            </a>
            <a href="/termos-de-uso" className="hover:text-volve-300">
              Termos de Uso
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
