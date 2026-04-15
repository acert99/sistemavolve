import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Sobre Nós',
  description:
    'Conheça a Volve: nossa história, missão, valores e o time por trás dos resultados.',
  alternates: { canonical: 'https://volve.com.br/sobre' },
}

const valores = [
  { icon: '🎯', titulo: 'Foco em resultados', desc: 'Toda estratégia é orientada por dados e métricas reais.' },
  { icon: '🤝', titulo: 'Transparência', desc: 'Relatórios claros e comunicação honesta em todo momento.' },
  { icon: '🚀', titulo: 'Inovação', desc: 'Sempre atualizados com as últimas tendências e ferramentas do mercado.' },
  { icon: '❤️', titulo: 'Parceria real', desc: 'Tratamos o negócio do cliente como se fosse o nosso próprio.' },
]

export default function SobrePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-volve-950 to-volve-900 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Sobre a Volve</h1>
          <p className="text-volve-300 text-lg max-w-2xl mx-auto">
            Somos uma agência digital com alma de startup: ágeis, criativos e obcecados por resultados.
          </p>
        </div>
      </section>

      {/* História */}
      <section className="section bg-white">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Nossa história</h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-600 leading-relaxed mb-4">
                A Volve nasceu da convicção de que marketing digital de qualidade não deveria ser privilégio apenas de grandes empresas. Fundada em São Paulo, construímos nossa reputação entregando resultados reais para negócios locais e empresas em crescimento.
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                Começamos como um time pequeno e dedicado, e hoje somos referência em estratégias integradas que combinam marketing digital, design criativo e tecnologia em uma abordagem 360° para o crescimento dos nossos clientes.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Cada cliente é um parceiro. Não acreditamos em contratos de gaveta: acreditamos em resultados que falam por si.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="section bg-gray-50">
        <div className="container">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Nossos valores</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {valores.map((v) => (
              <div key={v.titulo} className="flex gap-4 bg-white rounded-2xl p-6 border border-gray-100">
                <span className="text-3xl flex-shrink-0">{v.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{v.titulo}</h3>
                  <p className="text-gray-500 text-sm">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section bg-volve-950 text-white">
        <div className="container text-center">
          <h2 className="text-3xl font-bold mb-4">Vamos trabalhar juntos?</h2>
          <p className="text-volve-300 mb-8 max-w-lg mx-auto">
            Agende uma conversa gratuita de 30 minutos e descubra como a Volve pode ajudar o seu negócio.
          </p>
          <Link href="/contato" className="btn-primary">
            Agendar conversa gratuita
          </Link>
        </div>
      </section>
    </>
  )
}
