import { randomUUID } from 'node:crypto'
import { addDays, format, getDay, parse } from 'date-fns'
import { normalizeText } from '@/lib/client-reports'

export type CalendarSlot = {
  date: string // YYYY-MM-DD
}

export function validateMonthRef(monthRef: string) {
  if (!/^\d{4}-\d{2}$/.test(monthRef)) throw new Error('Mes invalido')
  const [y, m] = monthRef.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) throw new Error('Mes invalido')
  return { year: y, month: m }
}

export function monthSlotsMonWedFri(monthRef: string): CalendarSlot[] {
  const { year, month } = validateMonthRef(monthRef)
  const start = parse(`${year}-${String(month).padStart(2, '0')}-01`, 'yyyy-MM-dd', new Date())
  const slots: CalendarSlot[] = []
  for (let d = start; format(d, 'MM') === String(month).padStart(2, '0'); d = addDays(d, 1)) {
    const dow = getDay(d) // 0=Sun
    if (dow === 1 || dow === 3 || dow === 5) {
      slots.push({ date: format(d, 'yyyy-MM-dd') })
    }
  }
  return slots
}

export function newBatchId() {
  return randomUUID()
}

export function slugifyClientName(name: string) {
  const normalized = normalizeText(name)
  return normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'cliente'
}
