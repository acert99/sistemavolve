import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Serviços',
  description:
    'Conheça os serviços da Volve: marketing digital, tráfego pago, design, desenvolvimento web, SEO e muito mais.',
  alternates: { canonical: 'https://volve.com.br/servicos' },
  openGraph: {
    title: 'Serviços | Volve Agência Digital',
    description: 'Soluções completas de marketing e tecnologia para o crescimento do seu negócio.',
    url: 'https://volve.com.br/servicos',
  },
}

const servicos = [
  {
    categoria: 'Marketing Digital',
    icon: '🎯',
    items: [
      {
        titulo: 'Tráfego Pago',
        desc: 'Campanhas estratégicas no Google Ads (Search, Display, YouTube, Shopping) e Meta Ads (Facebook e Instagram). Otimização contínua para maximizar o ROI e reduzir o custo por aquisição.',
        tags: ['Google Ads', 'Meta Ads', 'ROI', 'Conversão'],
      },
      {
        titulo: 'SEO',
        desc: 'Estratégia completa de Search Engine Optimization: auditoria técnica, otimização on-page, link building e criação de conteúdo para ranquear sua empresa no topo do Google.',
        tags: ['SEO Técnico', 'Link Building', 'Conteúdo', 'Analytics'],
      },
      {
        titulo: 'E-mail Marketing',
        desc: 'Criação de fluxos de automação, campanhas segmentadas e nurturing de leads para converter contatos em clientes com alta taxa de abertura.',
        tags: ['Automação', 'Segmentação', 'Nutrição de leads'],
      },
    ],
  },
  {
    categoria: 'Redes Sociais',
    icon: '📱',
    items: [
      {
        titulo: 'Social Media',
        desc: 'Gestão completa das suas redes sociais: planejamento editorial, criação de conteúdo, publicação, monitoramento e relatórios mensais de desempenho.',
        tags: ['Instagram', 'Facebook', 'LinkedIn', 'TikTok'],
      },
      {
        titulo: 'Produção de Conteúdo',
        desc: 'Vídeos, reels, carrosséis e stories que engajam o seu público. Roteiro, gravação, edição e legendagem.',
        tags: ['Vídeo', 'Reels', 'Fotografia', 'Copywriting'],
      },
    ],
  },
  {
    categoria: 'Design & Criativo',
    icon: '🎨',
    items: [
      {
        titulo: 'Identidade Visual',
        desc: 'Criação de logotipo, paleta de cores, tipografia e manual de marca para posicionar seu negócio de forma profissional e consistente.',
        tags: ['Logo', 'Branding', 'Manual de marca'],
      },
      {
        titulo: 'Design Gráfico',
        desc: 'Peças para redes sociais, apresentações, catálogos, banners, embalagens e materiais impressos com design de alto nível.',
        tags: ['Figma', 'Adobe CC', 'Print', 'Digital'],
      },
    ],
  },
  {
    categoria: 'Tecnologia',
    icon: '💻',
    items: [
      {
        titulo: 'Desenvolvimento Web',
        desc: 'Sites institucionais, landing pages de alta conversão e lojas virtuais com foco em performance, SEO e experiência do usuário.',
        tags: ['Next.js', 'React', 'WordPress', 'E-commerce'],
      },
      {
        titulo: 'Automação & CRM',
        desc: 'Integração de ferramentas, chatbots para WhatsApp, automações de marketing e implementação de CRM para escalar suas vendas.',
        tags: ['WhatsApp', 'CRM', 'Automação', 'Chatbot'],
      },
    ],
  },
]

export default function ServicosPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-volve-950 to-volve-900 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Nossos Serviços</h1>
          <p className="text-volve-300 text-lg">
            Tudo que seu negócio precisa para crescer no digital, em um só lugar.
          </p>
        </div>
      </section>

      {/* Serviços */}
      <section className="section bg-white">
        <div className="container">
          <div className="space-y-20">
            {servicos.map((categoria) => (
              <div key={categoria.categoria}>
                <div className="flex items-center gap-3 mb-8">
                  <span className="text-3xl">{categoria.icon}</span>
                  <h2 className="text-2xl font-bold text-gray-900">{categoria.categoria}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {categoria.items.map((item) => (
                    <div
                      key={item.titulo}
                      className="rounded-2xl border border-gray-100 p-6 bg-gray-50
                                 hover:border-volve-200 hover:bg-volve-50/50 transition-colors"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.titulo}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed mb-4">{item.desc}</p>
                      <div className="flex flex-wrap gap-2">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-volve-100 px-3 py-1 text-xs font-medium text-volve-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-20 text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Não encontrou o que procurava?
            </h3>
            <p className="text-gray-500 mb-6">
              Desenvolvemos soluções personalizadas para cada negócio. Fale com a gente!
            </p>
            <Link href="/contato" className="btn-primary">
              Solicitar orçamento personalizado
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
