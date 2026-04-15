'use client'

import { useState } from 'react'
import type { Metadata } from 'next'

// Contato form — envia para WhatsApp ou para um endpoint de API
// Para backend real: configure um endpoint ou use Formspree/Resend

export default function ContatoPage() {
  const [form, setForm] = useState({
    nome: '',
    email: '',
    empresa: '',
    servico: '',
    mensagem: '',
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')

    // Monta mensagem para WhatsApp (fallback simples)
    const texto = encodeURIComponent(
      `Olá, Volve! Meu nome é ${form.nome}.\n` +
        `Empresa: ${form.empresa || 'Não informado'}\n` +
        `Interesse: ${form.servico || 'Não informado'}\n\n` +
        `${form.mensagem}`,
    )

    // Redireciona para WhatsApp (substitua pelo número real)
    window.open(`https://wa.me/5511999999999?text=${texto}`, '_blank')
    setStatus('success')
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-volve-950 to-volve-900 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Fale com a gente</h1>
          <p className="text-volve-300 text-lg">
            Estamos prontos para ajudar o seu negócio a crescer.
          </p>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Info de contato */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Vamos conversar?
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                Preencha o formulário ao lado ou entre em contato diretamente pelos nossos canais. Respondemos em até 24 horas úteis.
              </p>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-volve-100 flex items-center justify-center text-xl flex-shrink-0">
                    💬
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">WhatsApp</p>
                    <a
                      href="https://wa.me/5511999999999"
                      target="_blank"
                      rel="noreferrer"
                      className="text-volve-600 hover:underline text-sm"
                    >
                      (11) 9 9999-9999
                    </a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-volve-100 flex items-center justify-center text-xl flex-shrink-0">
                    ✉️
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">E-mail</p>
                    <a
                      href="mailto:contato@volve.com.br"
                      className="text-volve-600 hover:underline text-sm"
                    >
                      contato@volve.com.br
                    </a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-volve-100 flex items-center justify-center text-xl flex-shrink-0">
                    📍
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Localização</p>
                    <p className="text-gray-500 text-sm">São Paulo, SP — Brasil</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Formulário */}
            <div className="bg-gray-50 rounded-2xl p-8">
              {status === 'success' ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-4">🎉</p>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Mensagem enviada!</h3>
                  <p className="text-gray-500">
                    Você foi redirecionado para o WhatsApp. Nossa equipe vai responder em breve!
                  </p>
                  <button
                    onClick={() => setStatus('idle')}
                    className="mt-6 text-volve-600 hover:underline text-sm"
                  >
                    Enviar outra mensagem
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome *
                      </label>
                      <input
                        name="nome"
                        required
                        className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm
                                   focus:border-volve-500 focus:outline-none focus:ring-1 focus:ring-volve-500"
                        value={form.nome}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        E-mail *
                      </label>
                      <input
                        name="email"
                        type="email"
                        required
                        className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm
                                   focus:border-volve-500 focus:outline-none focus:ring-1 focus:ring-volve-500"
                        value={form.email}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                    <input
                      name="empresa"
                      className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm
                                 focus:border-volve-500 focus:outline-none focus:ring-1 focus:ring-volve-500"
                      value={form.empresa}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Serviço de interesse
                    </label>
                    <select
                      name="servico"
                      className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm
                                 focus:border-volve-500 focus:outline-none focus:ring-1 focus:ring-volve-500"
                      value={form.servico}
                      onChange={handleChange}
                    >
                      <option value="">Selecione…</option>
                      <option>Tráfego Pago</option>
                      <option>Social Media</option>
                      <option>SEO</option>
                      <option>Design</option>
                      <option>Desenvolvimento Web</option>
                      <option>E-mail Marketing</option>
                      <option>Pacote completo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mensagem *
                    </label>
                    <textarea
                      name="mensagem"
                      required
                      rows={4}
                      className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm
                                 focus:border-volve-500 focus:outline-none focus:ring-1 focus:ring-volve-500
                                 resize-none"
                      placeholder="Conta um pouco sobre o seu negócio e o que você precisa…"
                      value={form.mensagem}
                      onChange={handleChange}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full btn-primary py-3.5"
                  >
                    {status === 'loading' ? 'Enviando…' : 'Enviar mensagem via WhatsApp'}
                  </button>

                  <p className="text-xs text-gray-400 text-center">
                    Ao enviar, você será redirecionado para o WhatsApp da Volve.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
