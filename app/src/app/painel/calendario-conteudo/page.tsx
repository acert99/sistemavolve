import type { Metadata } from 'next'
import { EmptyState } from '@/components/panel/empty-state'
import { PageHeader } from '@/components/panel/page-header'
import { listContentCalendars } from '@/lib/content-calendar'
import { formatDateTimeInAppTimeZone } from '@/lib/timezone'

export const metadata: Metadata = { title: 'Calendario de Conteudo' }
export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const names = [
    'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]
  return `${names[(monthNumber || 1) - 1]}/${year}`
}

function humanizeSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default async function ContentCalendarPage({ searchParams }: PageProps) {
  const showOldVersions = searchParams?.versions === 'all'
  const months = await listContentCalendars({ includeOldVersions: showOldVersions })
  const totalPdfs = months.reduce((sum, month) => sum + month.pdfs.length, 0)

  return (
    <main className="space-y-8">
      <PageHeader
        eyebrow="Conteudo"
        title="Calendario de Conteudo"
        description="PDFs mensais gerados automaticamente a partir do ClickUp, com itens fixos priorizados e recorrencias preenchidas nos dias restantes."
        meta={[
          { label: `${months.length} mes(es)` },
          { label: `${totalPdfs} PDF(s)`, tone: totalPdfs > 0 ? 'success' : 'warning' },
          { label: 'Segunda 09:00 BRT' },
        ]}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <a
          href="/painel/calendario-conteudo/ideias"
          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Aprovar ideias com IA
        </a>
        <a
          href={showOldVersions ? '/painel/calendario-conteudo' : '/painel/calendario-conteudo?versions=all'}
          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {showOldVersions ? 'Ocultar versoes antigas' : 'Mostrar versoes antigas'}
        </a>
      </div>

      {months.length === 0 ? (
        <EmptyState
          title="Nenhum calendario gerado ainda"
          description="A automacao roda na segunda-feira da ultima semana do mes. Quando gerar, os PDFs aparecem aqui por mes e por cliente."
        />
      ) : (
        <section className="space-y-6">
          {months.map((month) => (
            <div key={month.month} className="panel-card space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="panel-kicker">{month.month}</p>
                  <h2 className="text-xl font-semibold text-slate-950">
                    {formatMonthLabel(month.month)}
                  </h2>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  {month.pdfs.length} arquivo(s)
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {month.pdfs.map((pdf) => (
                  <article
                    key={`${pdf.month}-${pdf.fileName}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="space-y-1">
                      <h3 className="font-semibold text-slate-950">
                        {humanizeSlug(pdf.clientSlug)}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {pdf.version ? `v${pdf.version}` : 'Sem versao'} · {formatSize(pdf.sizeBytes)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Atualizado em {formatDateTimeInAppTimeZone(new Date(pdf.updatedAt))}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <a
                        href={`${pdf.downloadPath}?mode=view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Visualizar
                      </a>
                      <a
                        href={pdf.downloadPath}
                        download
                        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                      >
                        Baixar
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
