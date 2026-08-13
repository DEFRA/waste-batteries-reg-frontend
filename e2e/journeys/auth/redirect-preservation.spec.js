import { test, expect } from '@playwright/test'

import { signIn, expectSignedInAs } from '../../support/journeys.js'
import { operatorUser } from '../../support/users.js'

/**
 * Manual checklist phase 3 — where you end up after signing in.
 *
 * The redirect is stashed in a yar-backed flash, so this is also the test that
 * catches yar's session cookie regressing to SameSite=Strict: a Strict cookie
 * is not sent on the redirect back from the identity provider, the flash comes
 * back empty, and the user silently lands on the home page instead.
 */
test.describe('Redirect preservation', { tag: '@auth' }, () => {
  test('returns the user to the page they asked for', async ({ page }) => {
    await signIn(page, operatorUser, {
      startAt: '/auth/sign-in?redirect=/about'
    })

    await expect(page).toHaveURL(/\/about$/)
    await expectSignedInAs(page, operatorUser)
  })

  test('refuses to bounce the user off the site', async ({ page, baseURL }) => {
    await signIn(page, operatorUser, {
      startAt: '/auth/sign-in?redirect=//evil.example'
    })

    // A protocol-relative path is absolute to a browser, so it is discarded
    await expect(page).toHaveURL(`${baseURL}/`)
    await expectSignedInAs(page, operatorUser)
  })

  test('refuses a backslash-prefixed absolute redirect too', async ({
    page,
    baseURL
  }) => {
    await signIn(page, operatorUser, {
      startAt: '/auth/sign-in?redirect=/\\evil.example'
    })

    await expect(page).toHaveURL(`${baseURL}/`)
  })
})
