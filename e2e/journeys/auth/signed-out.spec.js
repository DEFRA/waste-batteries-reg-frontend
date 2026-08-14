import { test, expect } from '@playwright/test'

import { expectSignedOut } from '../../support/journeys.js'
import {
  expectNoTokensInBrowser,
  sessionCookieName
} from '../../support/invariants.js'
import { findCookie } from '../../support/http.js'

/**
 * Manual checklist phase 1 — what a visitor who has never signed in sees.
 */
test.describe('Signed-out visitor', { tag: '@auth' }, () => {
  test('is offered a sign-in link and carries no session', async ({ page }) => {
    await page.goto('/')

    await expectSignedOut(page)
    expect(await findCookie(page.context(), sessionCookieName)).toBeUndefined()
  })

  test('has a CSRF cookie but nothing token-shaped anywhere', async ({
    page
  }) => {
    await page.goto('/')

    expect(await findCookie(page.context(), 'crumb')).toBeDefined()
    await expectNoTokensInBrowser(page)
  })

  test('gets a cacheable home page while signed out', async ({ page }) => {
    const response = await page.goto('/')

    // no-store is reserved for authenticated responses; applying it here would
    // needlessly defeat caching of a public page
    expect(response.headers()['cache-control']).not.toBe('no-store')
  })
})
