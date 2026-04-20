export const APP_TIME_ZONE = 'America/Sao_Paulo'

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function hasExplicitTimeZone(value: string) {
  return /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value)
}

function getZonedParts(date: Date): ZonedParts {
  const values = DATE_TIME_FORMATTER.formatToParts(date).reduce<Record<string, string>>(
    (accumulator, part) => {
      if (part.type !== 'literal') {
        accumulator[part.type] = part.value
      }

      return accumulator
    },
    {},
  )

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function buildDateKey(parts: Pick<ZonedParts, 'year' | 'month' | 'day'>) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

function buildDateTimeLocalValue(parts: ZonedParts) {
  return `${buildDateKey(parts)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

function buildUtcLikeDate(parts: ZonedParts) {
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  )
}

function getTimeZoneOffsetMs(date: Date) {
  const parts = getZonedParts(date)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )

  return asUtc - date.getTime()
}

function zonedDateTimeToUtc(parts: ZonedParts) {
  const utcGuess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  )
  const offset = getTimeZoneOffsetMs(utcGuess)

  return new Date(utcGuess.getTime() - offset)
}

function parseLooseDateTime(value: string) {
  const match = value.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2})(?::(\d{2}))?(?::(\d{2}))?)?$/,
  )

  if (!match) return null

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? '0'),
    minute: Number(match[5] ?? '0'),
    second: Number(match[6] ?? '0'),
  } satisfies ZonedParts
}

export function parseDateTimeInAppTimeZone(value?: string | null) {
  if (!value) return null

  if (hasExplicitTimeZone(value)) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parts = parseLooseDateTime(value)
  if (!parts) return null

  return zonedDateTimeToUtc(parts)
}

export function toIsoStringInAppTimeZone(value: string) {
  const parsed = parseDateTimeInAppTimeZone(value)
  return parsed ? parsed.toISOString() : value
}

export function parseDateOnlyInAppTimeZone(value?: string | null) {
  if (!value) return null

  const trimmed = value.trim()
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00`
    : trimmed

  return parseDateTimeInAppTimeZone(normalized)
}

export function toDateTimeLocalInputValue(value: string | Date) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  return buildDateTimeLocalValue(getZonedParts(parsed))
}

export function formatDateTimeInAppTimeZone(value: string | Date) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  const parts = getZonedParts(parsed)
  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year} ${pad(parts.hour)}:${pad(parts.minute)}`
}

export function formatDateInAppTimeZone(value: string | Date) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  const parts = getZonedParts(parsed)
  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`
}

export function toDateOnlyIsoInAppTimeZone(value: string | Date) {
  const parsed = value instanceof Date ? value : parseDateOnlyInAppTimeZone(value)
  if (!parsed || Number.isNaN(parsed.getTime())) return ''

  return buildDateKey(getZonedParts(parsed))
}

export function getDateKeyInAppTimeZone(value: string | Date) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  return buildDateKey(getZonedParts(parsed))
}

export function buildNextHourDateTimeLocalInput() {
  const current = buildUtcLikeDate(getZonedParts(new Date()))
  current.setUTCMinutes(0, 0, 0)
  current.setUTCHours(current.getUTCHours() + 1)

  return `${current.getUTCFullYear()}-${pad(current.getUTCMonth() + 1)}-${pad(current.getUTCDate())}T${pad(current.getUTCHours())}:${pad(current.getUTCMinutes())}`
}

export function getAppDayRange(reference: Date = new Date()) {
  const localReference = buildUtcLikeDate(getZonedParts(reference))
  localReference.setUTCHours(0, 0, 0, 0)

  const nextDay = new Date(localReference)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)

  return {
    start: zonedDateTimeToUtc({
      year: localReference.getUTCFullYear(),
      month: localReference.getUTCMonth() + 1,
      day: localReference.getUTCDate(),
      hour: localReference.getUTCHours(),
      minute: localReference.getUTCMinutes(),
      second: localReference.getUTCSeconds(),
    }),
    end: zonedDateTimeToUtc({
      year: nextDay.getUTCFullYear(),
      month: nextDay.getUTCMonth() + 1,
      day: nextDay.getUTCDate(),
      hour: nextDay.getUTCHours(),
      minute: nextDay.getUTCMinutes(),
      second: nextDay.getUTCSeconds(),
    }),
  }
}

export function differenceInAppCalendarDays(left: string | Date, right: string | Date) {
  const leftKey = getDateKeyInAppTimeZone(left)
  const rightKey = getDateKeyInAppTimeZone(right)

  if (!leftKey || !rightKey) return NaN

  const [leftYear, leftMonth, leftDay] = leftKey.split('-').map(Number)
  const [rightYear, rightMonth, rightDay] = rightKey.split('-').map(Number)

  const leftUtc = Date.UTC(leftYear, leftMonth - 1, leftDay)
  const rightUtc = Date.UTC(rightYear, rightMonth - 1, rightDay)

  return Math.round((leftUtc - rightUtc) / 86400000)
}
