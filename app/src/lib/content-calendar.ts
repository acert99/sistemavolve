import fs from 'node:fs/promises'
import path from 'node:path'

export interface ContentCalendarPdf {
  month: string
  clientSlug: string
  fileName: string
  version: string | null
  sizeBytes: number
  updatedAt: string
  downloadPath: string
}

export interface ContentCalendarMonth {
  month: string
  pdfs: ContentCalendarPdf[]
}

export interface ListContentCalendarsOptions {
  includeOldVersions?: boolean
}

export const CONTENT_CALENDAR_ROOT = path.resolve(
  process.env.CONTENT_CALENDAR_REPORT_ROOT || '/app/reports/calendario-conteudo',
)

function versionFromFile(name: string) {
  return name.match(/-v(\d+)\.pdf$/i)?.[1] ?? null
}

function clientSlugFromFile(name: string) {
  return name.replace(/^calendario-/, '').replace(/-v\d+\.pdf$/i, '')
}

function versionNumber(version: string | null) {
  if (!version) return -1
  const parsed = Number(version)
  return Number.isFinite(parsed) ? parsed : -1
}

export async function listContentCalendars(
  options: ListContentCalendarsOptions = {},
): Promise<ContentCalendarMonth[]> {
  try {
    const monthEntries = await fs.readdir(CONTENT_CALENDAR_ROOT, {
      withFileTypes: true,
    })

    const months = await Promise.all(
      monthEntries
        .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}$/.test(entry.name))
        .map(async (entry) => {
          const monthDir = path.join(CONTENT_CALENDAR_ROOT, entry.name)
          const files = await fs.readdir(monthDir, { withFileTypes: true })

          const pdfs = await Promise.all(
            files
              .filter((file) => file.isFile() && file.name.toLowerCase().endsWith('.pdf'))
              .map(async (file) => {
                const fullPath = path.join(monthDir, file.name)
                const stat = await fs.stat(fullPath)
                const version = versionFromFile(file.name)
                return {
                  month: entry.name,
                  clientSlug: clientSlugFromFile(file.name),
                  fileName: file.name,
                  version,
                  sizeBytes: stat.size,
                  updatedAt: stat.mtime.toISOString(),
                  downloadPath: `/api/calendario-conteudo/download/${entry.name}/${encodeURIComponent(file.name)}`,
                }
              }),
          )

          const pdfsToReturn = options.includeOldVersions
            ? pdfs
            : Array.from(
                pdfs
                  .reduce((acc, pdf) => {
                    const existing = acc.get(pdf.clientSlug)
                    if (!existing) {
                      acc.set(pdf.clientSlug, pdf)
                      return acc
                    }

                    if (versionNumber(pdf.version) > versionNumber(existing.version)) {
                      acc.set(pdf.clientSlug, pdf)
                    }
                    return acc
                  }, new Map<string, ContentCalendarPdf>())
                  .values(),
              )

          return {
            month: entry.name,
            pdfs: pdfsToReturn.sort((a, b) => {
              const slugCmp = a.clientSlug.localeCompare(b.clientSlug)
              if (slugCmp !== 0) return slugCmp
              return versionNumber(b.version) - versionNumber(a.version)
            }),
          }
        }),
    )

    return months
      .filter((month) => month.pdfs.length > 0)
      .sort((a, b) => b.month.localeCompare(a.month))
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') return []
    throw err
  }
}

export function resolveCalendarPdfPath(month: string, fileName: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Mes invalido')
  }
  if (!/^[a-z0-9-]+-v\d+\.pdf$/i.test(fileName) && !/^calendario-[a-z0-9-]+-v\d+\.pdf$/i.test(fileName)) {
    throw new Error('Arquivo invalido')
  }

  const resolved = path.resolve(CONTENT_CALENDAR_ROOT, month, fileName)
  if (!resolved.startsWith(CONTENT_CALENDAR_ROOT + path.sep)) {
    throw new Error('Caminho invalido')
  }
  return resolved
}
