import { test, expect } from '@playwright/test'
import { setTimeout as delay } from 'node:timers/promises'

import {
  signIn,
  expectSignedOut,
  expectRedirectToSignIn
} from '../../support/journeys.js'
import { pastTheCapMs } from '../../support/app-instances.js'
import { operatorUser } from '../../support/users.js'

/**
 * Manual checklist phase 10 — the absolute session cap.
 *
 * Token refresh and cookie keep-alive are both rolling, so without a cap
 * measured from sign-in an active session lives as long as the refresh token
 * does. This instance shrinks the cap from four hours to seconds; everything
 * else about it is the default configuration.
 */

/** Waits out the cap, counting from when the session was created. */
function waitPastTheCap(signedInAt) {
  return delay(Math.max(0, pastTheCapMs - (Date.now() - signedInAt)))
}

// The only journeys that spend real time waiting rather than driving the app,
// so they carry a budget scaled to the cap — and a tag, for running everything
// else quickly
test.describe('Absolute session ttl', { tag: ['@auth', '@slow'] }, () => {
  test.beforeEach(() => {
    test.setTimeout(pastTheCapMs + 45000)
  })

  test('lets the user browse, then ends the session at the cap', async ({
    page
  }) => {
    await signIn(page, operatorUser)
    const signedInAt = Date.now()

    const beforeCap = await page.goto('/e2e/protected')
    expect(beforeCap.status()).toBe(200)

    await waitPastTheCap(signedInAt)

    // Bounced to sign in, with no error page on the way
    await expectRedirectToSignIn(page, '/e2e/protected')
  })

  test('shows the home page as signed out once the cap has passed', async ({
    page
  }) => {
    await signIn(page, operatorUser)
    const signedInAt = Date.now()

    await waitPastTheCap(signedInAt)

    await page.goto('/')
    await expectSignedOut(page)
  })
})
