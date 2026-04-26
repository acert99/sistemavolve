import Redis from 'ioredis'

declare global {
  // eslint-disable-next-line no-var
  var __volveRedisClient: Redis | undefined
}

const REDIS_URL = process.env.REDIS_URL
const SESSION_BLOCKLIST_PREFIX = 'auth:blocklist:'
let redisWarningShown = false

function logRedisWarning(error: unknown) {
  if (redisWarningShown) return

  redisWarningShown = true
  console.warn('[Redis] Redis indisponivel, algumas protecoes e caches ficaram degradados:', error)
}

async function getRedisClient() {
  if (!REDIS_URL) return null

  if (!global.__volveRedisClient) {
    global.__volveRedisClient = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    })
  }

  const client = global.__volveRedisClient

  try {
    if (client.status === 'wait') {
      await client.connect()
    }

    return client
  } catch (error) {
    logRedisWarning(error)
    return null
  }
}

export async function revokeBlockedSession(
  sessionId: string,
  expiresAtEpochSeconds: number,
): Promise<boolean> {
  const client = await getRedisClient()
  if (!client) return false

  const ttlSeconds = Math.max(
    1,
    Math.ceil(expiresAtEpochSeconds - Date.now() / 1000),
  )

  try {
    await client.set(
      `${SESSION_BLOCKLIST_PREFIX}${sessionId}`,
      '1',
      'EX',
      ttlSeconds,
    )
    return true
  } catch (error) {
    logRedisWarning(error)
    return false
  }
}

export async function isBlockedSession(sessionId: string): Promise<boolean> {
  const client = await getRedisClient()
  if (!client) return false

  try {
    return (await client.exists(`${SESSION_BLOCKLIST_PREFIX}${sessionId}`)) === 1
  } catch (error) {
    logRedisWarning(error)
    return false
  }
}

export async function incrementCounter(
  key: string,
  ttlSeconds: number,
): Promise<number | null> {
  const client = await getRedisClient()
  if (!client) return null

  try {
    const count = await client.incr(key)

    if (count === 1) {
      await client.expire(key, Math.max(1, ttlSeconds))
    }

    return count
  } catch (error) {
    logRedisWarning(error)
    return null
  }
}

export async function deleteKey(key: string): Promise<number> {
  const client = await getRedisClient()
  if (!client) return 0

  try {
    return await client.del(key)
  } catch (error) {
    logRedisWarning(error)
    return 0
  }
}

export const CACHE_KEYS = {
  clickupSpaces: (teamId: string) => `clickup:team:${teamId}:spaces`,
  clickupFolders: (spaceId: string) => `clickup:space:${spaceId}:folders`,
  clickupLists: (folderId: string) => `clickup:folder:${folderId}:lists`,
  clickupTasks: (teamId: string, folderId: string, listId: string | null = null) =>
    `clickup:team:${teamId}:tasks:${folderId}:${listId ?? 'all'}`,
  clickupTasksPrefix: (teamId: string) => `clickup:team:${teamId}:tasks:`,
} as const

export async function getOrSet<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds: number,
): Promise<T> {
  const client = await getRedisClient()

  if (!client) {
    return loader()
  }

  try {
    const cached = await client.get(key)
    if (cached) {
      return JSON.parse(cached) as T
    }
  } catch (error) {
    logRedisWarning(error)
    return loader()
  }

  const fresh = await loader()

  try {
    await client.set(key, JSON.stringify(fresh), 'EX', Math.max(1, ttlSeconds))
  } catch (error) {
    logRedisWarning(error)
  }

  return fresh
}

export async function deleteByPrefix(prefix: string) {
  const client = await getRedisClient()
  if (!client) return 0

  let cursor = '0'
  let deleted = 0

  try {
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        '100',
      )

      cursor = nextCursor

      if (keys.length > 0) {
        deleted += await client.del(...keys)
      }
    } while (cursor !== '0')
  } catch (error) {
    logRedisWarning(error)
  }

  return deleted
}
