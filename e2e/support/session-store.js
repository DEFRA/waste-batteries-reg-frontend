import { Redis } from 'ioredis'

/**
 * Reads the Redis-backed session store directly.
 *
 * The key layout under test is the product of two separate settings: ioredis
 * applies `redis.keyPrefix`, catbox appends `<segment>:<id>`. Nothing in the
 * unit tests exercises that combination, which is exactly why the manual
 * checklist inspects it by hand.
 */

const keyPrefix = 'waste-batteries-reg-frontend:'
const segment = 'defra-id-session'

export const sessionKeyPattern = `${keyPrefix}${segment}:*`

async function withRedis(callback) {
  const client = new Redis({
    host: '127.0.0.1',
    port: 6379,
    db: 0,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    // Fail fast rather than reconnecting forever when Redis is not up
    retryStrategy: () => null
  })

  try {
    return await callback(client)
  } finally {
    client.disconnect()
  }
}

export async function listSessionKeys() {
  return withRedis(async (client) => {
    const keys = []
    let cursor = '0'

    do {
      const [next, batch] = await client.scan(
        cursor,
        'MATCH',
        sessionKeyPattern,
        'COUNT',
        100
      )
      cursor = next
      keys.push(...batch)
    } while (cursor !== '0')

    return keys
  })
}

/**
 * Finds the stored session belonging to one user. Identifying it by email
 * rather than by "the key that appeared most recently" keeps the journey safe
 * to run alongside anything else using the same local Redis.
 */
export async function findStoredSession(email) {
  const keys = await listSessionKeys()

  return withRedis(async (client) => {
    for (const key of keys) {
      const raw = await client.get(key)
      // catbox wraps the value: { item, stored, ttl }
      const envelope = raw ? JSON.parse(raw) : null

      if (envelope?.item?.email === email) {
        return {
          key,
          session: envelope.item,
          raw,
          ttlRemainingMs: await client.pttl(key)
        }
      }
    }

    return null
  })
}

/**
 * Removes any session left behind for one user by an earlier test or run.
 * Sessions live for four hours, so without this a later assertion could be
 * reading a stale entry that happens to share the email.
 */
export async function dropStoredSessions(email) {
  const keys = await listSessionKeys()

  return withRedis(async (client) => {
    for (const key of keys) {
      const raw = await client.get(key)
      const envelope = raw ? JSON.parse(raw) : null

      if (envelope?.item?.email === email) {
        await client.del(key)
      }
    }
  })
}

export async function isRedisReachable() {
  try {
    await withRedis((client) => client.ping())
    return true
  } catch {
    return false
  }
}
