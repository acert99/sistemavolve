import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Volve — Agência Digital | Marketing, Design e Tecnologia',
  alternates: { canonical: 'https://volve.com.br' },
}

const servicos = [
  { icon: '📱', titulo: 'Social Media', desc: 'Gestão profissional das suas redes sociais com conteúdo estratégico e autêntico.' },
  { icon: '🎯', titulo: 'Tráfego Pago', desc: 'Campanhas no Google Ads e Meta Ads otimizadas para máximo ROI.' },
  { icon: '🎨', titulo: 'Design Criativo', desc: 'Identidade visual, materiais gráficos e interfaces que encantam.' },
  { icon: '💻', titulo: 'Desenvolvimento Web', desc: 'Sites, landing pages e sistemas web rápidos e modernos.' },
  { icon: '📈', titulo: 'SEO', desc: 'Estratégias de otimização para Google que geram tráfego orgânico de qualidade.' },
  { icon: '✉️', titulo: 'E-mail Marketing', desc: 'Campanhas segmentadas que convertem leads em clientes.' },
]

const depoimentos = [
  {
    nome: 'Maria Silva',
    empresa: 'Boutique Flora',
    texto: 'A Volve transformou a presença digital da nossa loja. As vendas online cresceram 180% em 6 meses!',
  },
  {
    nome: 'Carlos Mendes',
    empresa: 'Construtora Apex',
    texto: 'Profissionalismo e resultados acima do esperado. Recomendo para qualquer empresa que queira crescer.',
  },
  {
    nome: 'Ana Rodrigues',
    empresa: 'Clínica Bem Estar',
    texto: 'Nossa agenda está lotada graças às campanhas da Volve. Parceiros incríveis!',
  },
]

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-volve-950 via-volve-900 to-volve-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-28 text-center">
          <span className="inline-block rounded-full bg-volve-700/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-volve-200 mb-6">
            Agência Digital
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Seu negócio merece<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-indigo-300">
              crescer de verdade
            </span>
          </h1>
          <p className="text-lg text-volve-300 max-w-2xl mx-auto mb-10">
            Marketing digital, design criativo e tecnologia trabalhando juntos para levar sua empresa ao próximo nível. Resultados reais, não promessas.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contato" className="btn-primary text-base py-4 px-8">
              Quero crescer com a Volve
            </Link>
            <Link href="/portfolio" className="btn-outline text-base py-4 px-8 border-white/30 text-white hover:bg-white/10">
              Ver portfólio
            </Link>
          </div>
        </div>
      </section>

      {/* Números */}
      <section className="bg-white py-14 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { num: '150+', label: 'Projetos entregues' },
              { num: '98%',  label: 'Satisfação dos clientes' },
              { num: '5x',   label: 'Média de ROI' },
              { num: '3',    label: 'Anos de experiência' },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-4xl font-bold text-volve-700">{item.num}</p>
                <p className="text-sm text-gray-500 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Serviços */}
      <section className="section bg-gray-50">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl text-gray-900 mb-4">
              O que fazemos por você
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Soluções completas de marketing e tecnologia para empresas que querem crescer de forma consistente.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {servicos.map((s) => (
              <div
                key={s.titulo}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm
                           hover:shadow-md hover:-translate-y-1 transition-all duration-200"
              >
                <span className="text-3xl">{s.icon}</span>
                <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">{s.titulo}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/servicos" className="btn-outline">
              Ver todos os serviços
            </Link>
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="section bg-volve-950 text-white">
        <div className="container">
          <h2 className="text-3xl md:text-4xl text-center mb-14">
            O que dizem nossos clientes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {depoimentos.map((d) => (
              <div
                key={d.nome}
                className="bg-volve-900 rounded-2xl p-6 border border-volve-800"
              >
                <p className="text-volve-200 text-sm leading-relaxed mb-6">
                  "{d.texto}"
                </p>
                <div>
                  <p className="font-semibold">{d.nome}</p>
                  <p className="text-volve-400 text-xs">{d.empresa}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="section bg-white">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl text-gray-900 mb-4">
            Pronto para decolar?
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto mb-8">
            Agende uma conversa gratuita e veja como a Volve pode ajudar o seu negócio a crescer.
          </p>
          <Link href="/contato" className="btn-primary text-lg py-4 px-10">
            Falar com a equipe agora
          </Link>
        </div>
      </section>
    </>
  )
}
