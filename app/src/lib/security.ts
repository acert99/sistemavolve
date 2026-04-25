import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { deleteKey, incrementCounter } from '@/lib/cache'

const CRON_AUTH_FAILURE_PREFIX = 'cron:auth-fail:'
const CRON_AUTH_FAILURE_LIMIT = 5
const CRON_AUTH_FAILURE_TTL_SECONDS = 60 * 60

const LOGIN_FAIL_PREFIX = 'login:fail:'
const LOGIN_FAIL_LIMIT = 10        // tentativas antes do bloqueio
const LOGIN_FAIL_TTL_SECONDS = 15 * 60  // janela de 15 minutos

export function safeCompareSecrets(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided ?? '', 'utf8')
  const expectedBuffer = Buffer.from(expected ?? '', 'utf8')

  if (
    providedBuffer.length === 0 ||
    expectedBuffer.length === 0 ||
    providedBuffer.length !== expectedBuffer.length
  ) {
    return false
  }

  return timingSafeEqual(providedBuffer, expectedBuffer)
}

function normalizeKeySegment(value: string) {
  return value.replace(/[^a-zA-Z0-9:._-]/g, '_')
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }

  return request.headers.get('x-real-ip') ?? 'unknown'
}

export async function validateCronRequest(request: NextRequest): Promise<
  { ok: true } |
  { ok: false; error: string; status: number }
> {
  const cronSecret = process.env.CRON_SECRET ?? ''

  if (!cronSecret) {
    return { ok: false, error: 'CRON_SECRET nao configurado', status: 500 }
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const providedSecret = authHeader.replace(/^Bearer\s+/i, '').trim()
  const rateLimitKey = `${CRON_AUTH_FAILURE_PREFIX}${normalizeKeySegment(getRequestIp(request))}`

  if (!safeCompareSecrets(providedSecret, cronSecret)) {
    const attempts = await incrementCounter(
      rateLimitKey,
      CRON_AUTH_FAILURE_TTL_SECONDS,
    )

    if (attempts !== null && attempts > CRON_AUTH_FAILURE_LIMIT) {
      return { ok: false, error: 'Too many attempts', status: 429 }
    }

    return { ok: false, error: 'Nao autorizado', status: 401 }
  }

  await deleteKey(rateLimitKey)

  return { ok: true }
}

// =============================================================================
// Rate limiting para tentativas de login
// =============================================================================

/**
 * Incrementa o contador de falhas de login para o e-mail informado.
 * Retorna `true` se o limite foi atingido (acesso bloqueado).
 * Chame ANTES de tentar autenticar — se retornar true, rejeite imediatamente.
 */
export async function incrementLoginFailure(email: string): Promise<boolean> {
  const key = `${LOGIN_FAIL_PREFIX}${normalizeKeySegment(email.toLowerCase())}`
  const attempts = await incrementCounter(key, LOGIN_FAIL_TTL_SECONDS)
  return attempts !== null && attempts > LOGIN_FAIL_LIMIT
}

/**
 * Apaga o contador de falhas de login após autenticação bem-sucedida.
 */
export async function clearLoginFailures(email: string): Promise<void> {
  const key = `${LOGIN_FAIL_PREFIX}${normalizeKeySegment(email.toLowerCase())}`
  await deleteKey(key)
}
