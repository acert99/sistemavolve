'use client'

import { useState } from 'react'
import type { ItemProposta } from '@/types'

interface PropostaPublica {
  id: string
  titulo: string
  descricao: string | null
  itens: unknown
  valorTotal: number
  token: string
  status: string
  validade: string | null
  createdAt: string
  cliente: { nome: string; email: string }
}

function moeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

export default function PropostaPublicaClient({
  proposta,
}: {
  proposta: PropostaPublica
}) {
  const [action, setAction] = useState<'aceitar' | 'recusar' | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [comment, setComment] = useState('')

  const itens = (proposta.itens as ItemProposta[]) ?? []
  const isEncerrada = ['aceita', 'recusada', 'expirada'].includes(proposta.status)
  const jaAceita = proposta.status === 'aceita'

  async function handleAcao(novoStatus: 'aceita' | 'recusada') {
    setLoading(true)

    await fetch(`/api/propostas/${proposta.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: novoStatus,
        feedback: comment.trim() || null,
      }),
    })

    setDone(true)
    setLoading(false)
    setAction(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-volve-950 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">VOLVE</h1>
            <p className="text-volve-300 text-xs">Agência Digital</p>
          </div>
          <span className="text-xs text-volve-400">Proposta Comercial</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Info */}
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{proposta.titulo}</h2>
              <p className="text-sm text-gray-500">
                Para: <strong>{proposta.cliente.nome}</strong>
              </p>
              <p className="text-sm text-gray-400">
                Emitida em{' '}
                {new Intl.DateTimeFormat('pt-BR').format(new Date(proposta.createdAt))}
                {proposta.validade && (
                  <> · Válida até{' '}
                    {new Intl.DateTimeFormat('pt-BR').format(new Date(proposta.validade))}
                  </>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-volve-700">
                {moeda(proposta.valorTotal)}
              </p>
              <p className="text-xs text-gray-400">Investimento total</p>
            </div>
          </div>

          {proposta.descricao && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-gray-600 text-sm whitespace-pre-line">{proposta.descricao}</p>
            </div>
          )}
        </div>

        {/* Itens */}
        <div className="card mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Detalhamento</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="pb-2">Item</th>
                <th className="pb-2 text-center">Qtd</th>
                <th className="pb-2 text-right">Valor unit.</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="py-3">
                    <p className="font-medium text-gray-900">{item.nome}</p>
                    {item.descricao && (
                      <p className="text-xs text-gray-400">{item.descricao}</p>
                    )}
                  </td>
                  <td className="py-3 text-center text-gray-600">{item.quantidade}</td>
                  <td className="py-3 text-right text-gray-600">
                    {moeda(item.valorUnitario)}
                  </td>
                  <td className="py-3 text-right font-semibold text-gray-900">
                    {moeda(item.quantidade * item.valorUnitario)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-4 text-right font-semibold text-gray-700">
                  Total:
                </td>
                <td className="pt-4 text-right text-xl font-bold text-volve-700">
                  {moeda(proposta.valorTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* CTA */}
        {done ? (
          <div className="card text-center py-10">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-lg font-semibold text-gray-900">Resposta registrada!</p>
            <p className="text-gray-500 text-sm mt-1">
              Nossa equipe já foi notificada. Em breve entraremos em contato.
            </p>
          </div>
        ) : isEncerrada ? (
          <div className="card text-center py-8">
            <p className="font-semibold text-gray-700">
              {jaAceita ? '✅ Proposta aceita' : '❌ Proposta encerrada'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {jaAceita
                ? 'Você já aceitou esta proposta. Aguarde o contato da equipe.'
                : 'Esta proposta não está mais disponível para resposta.'}
            </p>
          </div>
        ) : (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">
              O que você acha desta proposta?
            </h3>
            {action ? (
              <div>
                {action === 'recusar' && (
                  <div className="mb-4">
                    <label className="label">
                      Pode nos dizer o motivo? (opcional)
                    </label>
                    <textarea
                      rows={3}
                      className="input resize-none"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Ajude-nos a melhorar…"
                    />
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAcao(action === 'aceitar' ? 'aceita' : 'recusada')}
                    disabled={loading}
                    className={action === 'aceitar' ? 'btn-primary flex-1' : 'btn-danger flex-1'}
                  >
                    {loading
                      ? 'Enviando…'
                      : action === 'aceitar'
                        ? 'Confirmar aceitação'
                        : 'Confirmar recusa'}
                  </button>
                  <button
                    onClick={() => setAction(null)}
                    className="btn-secondary"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => setAction('aceitar')}
                  className="btn-primary flex-1 py-3"
                >
                  ✅ Aceitar proposta
                </button>
                <button
                  onClick={() => setAction('recusar')}
                  className="btn-secondary flex-1 py-3"
                >
                  Recusar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8">
          Volve Agencia Digital · contato@volvemkt.com · volvemkt.com
        </p>
      </div>
    </div>
  )
}
