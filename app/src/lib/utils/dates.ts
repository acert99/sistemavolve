import { APP_TIME_ZONE, getDateKeyInAppTimeZone } from '@/lib/timezone'

function toAppDay(value: Date | string) {
  const dateKey = getDateKeyInAppTimeZone(value)
  const [year, month, day] = dateKey.split('-').map(Number)

  return new Date(Date.UTC(year, month - 1, day))
}

export function calcularDiasUteisAte(inicio: Date | string, fim: Date | string) {
  const cursor = toAppDay(inicio)
  const alvo = toAppDay(fim)

  let count = 0

  while (cursor < alvo) {
    cursor.setDate(cursor.getDate() + 1)

    const dayOfWeek = cursor.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count += 1
    }
  }

  return count
}

export function isSexta(reference: Date | string = new Date()) {
  return toAppDay(reference).getDay() === 5
}

export function labelAmanha(reference: Date | string = new Date()) {
  return isSexta(reference) ? 'Segunda-feira' : 'Amanha'
}

export function formatWeekdayInAppTimeZone(value: Date | string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIME_ZONE,
    weekday: 'long',
  }).format(new Date(value))
}

export function getAppDateKey(value: Date | string) {
  return getDateKeyInAppTimeZone(value)
}
