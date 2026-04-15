import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portfólio',
  description:
    'Veja os cases de sucesso da Volve: projetos de marketing digital, design e desenvolvimento web que geraram resultados reais.',
  alternates: { canonical: 'https://volve.com.br/portfolio' },
}

const cases = [
  {
    cliente: 'Boutique Flora',
    segmento: 'E-commerce · Moda',
    resultado: '+180% em vendas online em 6 meses',
    descricao: 'Estratégia integrada de tráfego pago + social media + e-mail marketing para loja de moda feminina.',
    servicos: ['Tráfego Pago', 'Social Media', 'E-mail Marketing'],
    cor: 'from-pink-500 to-rose-600',
  },
  {
    cliente: 'Construtora Apex',
    segmento: 'Imobiliário · B2B',
    resultado: '3x mais leads qualificados',
    descricao: 'Landing page de alta conversão + Google Ads focado em leads para lançamentos imobiliários.',
    servicos: ['Google Ads', 'Landing Page', 'SEO'],
    cor: 'from-blue-600 to-indigo-700',
  },
  {
    cliente: 'Clínica Bem Estar',
    segmento: 'Saúde · Local',
    resultado: 'Agenda 100% cheia em 4 meses',
    descricao: 'Gestão de redes sociais + Meta Ads + automação de WhatsApp para clínica de estética.',
    servicos: ['Social Media', 'Meta Ads', 'WhatsApp Bot'],
    cor: 'from-emerald-500 to-teal-600',
  },
  {
    cliente: 'TechFlow SaaS',
    segmento: 'Tecnologia · SaaS',
    resultado: '+240% em cadastros orgânicos',
    descricao: 'SEO técnico e estratégia de conteúdo para plataforma B2B de automação empresarial.',
    servicos: ['SEO', 'Marketing de Conteúdo', 'Analytics'],
    cor: 'from-violet-600 to-purple-700',
  },
  {
    cliente: 'Restaurante Sabores',
    segmento: 'Food & Beverage · Local',
    resultado: '90% de aumento no delivery',
    descricao: 'Identidade visual completa + social media com foco em engajamento e campanhas de delivery.',
    servicos: ['Identidade Visual', 'Social Media', 'Design'],
    cor: 'from-orange-500 to-amber-600',
  },
  {
    cliente: 'Academia FitLife',
    segmento: 'Fitness · Assinatura',
    resultado: '160 novos alunos em 2 meses',
    descricao: 'Campanha de lançamento com tráfego pago + captação via WhatsApp + automação de nurturing.',
    servicos: ['Meta Ads', 'CRM', 'Automação'],
    cor: 'from-cyan-500 to-sky-600',
  },
]

export default function PortfolioPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-volve-950 to-volve-900 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Portfólio</h1>
          <p className="text-volve-300 text-lg">
            Cases reais de negócios que cresceram com a Volve.
          </p>
        </div>
      </section>

      {/* Cases */}
      <section className="section bg-gray-50">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cases.map((c) => (
              <div
                key={c.cliente}
                className="bg-white rounded-2xl overflow-hidden shadow-sm
                           hover:shadow-md transition-all duration-200 hover:-translate-y-1"
              >
                {/* Color header */}
                <div className={`h-3 bg-gradient-to-r ${c.cor}`} />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {c.segmento}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{c.cliente}</h3>
                  <p className="text-gray-500 text-sm mb-4 leading-relaxed">{c.descricao}</p>

                  {/* Resultado destaque */}
                  <div className={`rounded-xl bg-gradient-to-r ${c.cor} p-3 mb-4`}>
                    <p className="text-white text-sm font-semibold text-center">{c.resultado}</p>
                  </div>

                  {/* Tags de serviços */}
                  <div className="flex flex-wrap gap-2">
                    {c.servicos.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <p className="text-gray-500 mb-6">
              Quer resultados como esses para o seu negócio?
            </p>
            <a href="/contato" className="btn-primary">
              Vamos conversar
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
