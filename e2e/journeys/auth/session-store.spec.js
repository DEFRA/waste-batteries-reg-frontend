import { test, expect } from '@playwright/test'

import { signIn, signOut } from '../../support/journeys.js'
import {
  dropStoredSessions,
  findStoredSession
} from '../../support/session-store.js'
import { looksLikeAJwt } from '../../support/invariants.js'
import { appInstances } from '../../support/app-instances.js'
import { sessionStoreUser } from '../../support/users.js'

/**
 * Manual checklist phase 8 — what a session actually looks like in Redis.
 *
 * The key layout is produced by two settings that never meet in a unit test:
 * ioredis prepends the service key prefix, catbox appends `<segment>:<id>`. Get
 * either wrong in a deployed environment and sessions silently collide with, or
 * hide from, the rest of the service's Redis namespace.
 */
const fourHoursMs = 14400000

// Needs the Redis-backed instance; the default app keeps sessions in memory
test.use({ baseURL: appInstances.sessionStore.url })

test.describe.configure({ mode: 'serial' })

test.describe('Session store', { tag: '@auth' }, () => {
  // Each test signs in afresh; clear the previous one so the assertions can
  // only be looking at the session this test created
  test.beforeEach(async () => {
    await dropStoredSessions(sessionStoreUser.email)
  })

  test('writes one namespaced key holding the profile and the tokens', async ({
    page
  }) => {
    await signIn(page, sessionStoreUser)

    const stored = await findStoredSession(sessionStoreUser.email)
    expect(stored, 'no session was written to Redis').not.toBeNull()

    expect(stored.key).toMatch(
      /^waste-batteries-reg-frontend:defra-id-session:[0-9a-f-]{36}$/
    )

    // Server-side only — this is the correct place for tokens to live
    expect(stored.session).toMatchObject({
      email: sessionStoreUser.email,
      displayName: sessionStoreUser.displayName,
      organisationName: sessionStoreUser.relationships[0].organisationName,
      createdAt: expect.any(String),
      expiresAt: expect.any(String)
    })
    expect(looksLikeAJwt(stored.session.accessToken)).toBe(true)
    expect(looksLikeAJwt(stored.session.refreshToken)).toBe(true)
    expect(looksLikeAJwt(stored.session.idToken)).toBe(true)
  })

  test('expires the key on the session cache ttl', async ({ page }) => {
    await signIn(page, sessionStoreUser)

    const stored = await findStoredSession(sessionStoreUser.email)

    expect(stored.ttlRemainingMs).toBeGreaterThan(fourHoursMs * 0.9)
    expect(stored.ttlRemainingMs).toBeLessThanOrEqual(fourHoursMs)
  })

  test('removes the key when the user signs out', async ({ page }) => {
    await signIn(page, sessionStoreUser)
    await page.goto('/')
    expect(await findStoredSession(sessionStoreUser.email)).not.toBeNull()

    await signOut(page)

    expect(await findStoredSession(sessionStoreUser.email)).toBeNull()
  })
})
