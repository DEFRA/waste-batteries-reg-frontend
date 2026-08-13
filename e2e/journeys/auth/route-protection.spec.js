import { test, expect } from '@playwright/test'

import {
  signIn,
  signOut,
  expectSignedInAs,
  expectAtIdentityProvider
} from '../../support/journeys.js'
import { redirectTarget } from '../../support/http.js'
import { operatorUser } from '../../support/users.js'

/**
 * Manual checklist phase 4 — the server-wide auth default.
 *
 * Home and about are deliberately public, so this drives /e2e/protected: a
 * route registered by the test harness with no auth options at all, which is
 * exactly how a new application route would arrive.
 */
test.describe('Route protection', { tag: '@auth' }, () => {
  const protectedPath = '/e2e/protected'

  test('sends a signed-out visitor to sign in, remembering where they were going', async ({
    request
  }) => {
    const response = await request.get(protectedPath, { maxRedirects: 0 })

    expect(response.status()).toBe(302)
    expect(redirectTarget(response).pathname).toBe('/auth/sign-in')
    expect(redirectTarget(response).searchParams.get('redirect')).toBe(
      protectedPath
    )
  })

  test('delivers the visitor back to the protected page after signing in', async ({
    page
  }) => {
    await page.goto(protectedPath)
    await expectAtIdentityProvider(page)

    await page
      .getByRole('row', { name: operatorUser.email })
      .getByRole('link', { name: 'Log in' })
      .click()

    await expect(page).toHaveURL(new RegExp(`${protectedPath}$`))
    await expect(page.getByTestId('e2e-page-heading')).toHaveText(
      'Protected page'
    )
  })

  test('renders normally, and uncacheably, for a signed-in user', async ({
    page
  }) => {
    await signIn(page, operatorUser)
    await expectSignedInAs(page, operatorUser)

    const response = await page.goto(protectedPath)

    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toBe('no-store')
  })

  test('is not served from the back-forward cache after signing out', async ({
    page
  }) => {
    await signIn(page, operatorUser)
    await page.goto(protectedPath)
    await expect(page.getByTestId('e2e-page-heading')).toBeVisible()

    await signOut(page)

    // no-store earning its keep: Back must re-request the page rather than
    // redisplay the signed-in copy, which bounces the user to sign in
    await page.goBack()
    await expectAtIdentityProvider(page)
  })
})
