'use client'

import { useEffect, useState } from 'react'

interface Aprovacao {
  id: string
  status: string
  comentario: string | null
  createdAt: string
  aprovadoEm: string | null
  entrega: {
    titulo: string
    descricao: string | null
    arquivoUrl: string | null
    status: string
  }
}

export default function ClienteAprovacoesPage() {
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<string | null>(null)
  const [comentarios, setComentarios] = useState<Record<string, string>>({})

  async function fetchAprovacoes() {
    setLoading(true)
    const res = await fetch('/api/aprovacoes?limit=50')
    const data = await res.json()
    if (data.success) setAprovacoes(data.data)
    setLoading(false)
  }

  useEffect(() => { fetchAprovacoes() }, [])

  async function responder(
    aprovacaoId: string,
    status: 'aprovado' | 'reprovado',
  ) {
    setResponding(aprovacaoId)

    await fetch('/api/aprovacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aprovacaoId,
        status,
        comentario: comentarios[aprovacaoId] ?? '',
      }),
    })

    setResponding(null)
    fetchAprovacoes()
  }

  const pendentes = aprovacoes.filter((a) => a.status === 'aguardando')
  const respondidas = aprovacoes.filter((a) => a.status !== 'aguardando')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Aprovações</h1>
      <p className="text-gray-500 mb-8">
        Revise as entregas da equipe e dê seu feedback.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Carregando…</p>
      ) : (
        <>
          {/* Pendentes */}
          {pendentes.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-amber-700 mb-4">
                ⏳ Aguardando sua resposta ({pendentes.length})
              </h2>
              <div className="space-y-4">
                {pendentes.map((ap) => (
                  <div
                    key={ap.id}
                    className="card border-l-4 border-l-amber-400"
                  >
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {ap.entrega.titulo}
                    </h3>
                    {ap.entrega.descricao && (
                      <p className="text-sm text-gray-500 mb-3">
                        {ap.entrega.descricao}
                      </p>
                    )}
                    {ap.entrega.arquivoUrl && (
                      <a
                        href={ap.entrega.arquivoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-volve-600
                                   hover:underline mb-4"
                      >
                        📎 Ver arquivo da entrega
                      </a>
                    )}
                    <div className="border-t border-gray-100 pt-4">
                      <label className="label">
                        Comentário / feedback (opcional)
                      </label>
                      <textarea
                        rows={2}
                        className="input resize-none mb-3"
                        placeholder="Descreva sua opinião ou o que precisa ser ajustado…"
                        value={comentarios[ap.id] ?? ''}
                        onChange={(e) =>
                          setComentarios({ ...comentarios, [ap.id]: e.target.value })
                        }
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => responder(ap.id, 'aprovado')}
                          disabled={responding === ap.id}
                          className="btn-primary flex-1"
                        >
                          ✅ Aprovar
                        </button>
                        <button
                          onClick={() => responder(ap.id, 'reprovado')}
                          disabled={responding === ap.id}
                          className="btn-danger flex-1"
                        >
                          ❌ Reprovar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Respondidas */}
          {respondidas.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                Histórico de aprovações
              </h2>
              <div className="card overflow-x-auto">
                <table className="table-auto w-full">
                  <thead>
                    <tr>
                      <th>Entrega</th>
                      <th>Resposta</th>
                      <th>Comentário</th>
                      <th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {respondidas.map((ap) => (
                      <tr key={ap.id}>
                        <td className="font-medium">{ap.entrega.titulo}</td>
                        <td>
                          <span
                            className={
                              ap.status === 'aprovado' ? 'badge-green' : 'badge-red'
                            }
                          >
                            {ap.status === 'aprovado' ? '✅ Aprovado' : '❌ Reprovado'}
                          </span>
                        </td>
                        <td className="text-gray-500 text-sm max-w-xs truncate">
                          {ap.comentario ?? '—'}
                        </td>
                        <td className="text-gray-400">
                          {ap.aprovadoEm
                            ? new Intl.DateTimeFormat('pt-BR').format(
                                new Date(ap.aprovadoEm),
                              )
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {aprovacoes.length === 0 && (
            <div className="card text-center py-10">
              <p className="text-3xl mb-2">🎯</p>
              <p className="text-gray-500">Nenhuma aprovação no momento.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
