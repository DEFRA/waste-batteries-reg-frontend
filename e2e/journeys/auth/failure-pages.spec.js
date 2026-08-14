import { test, expect } from '@playwright/test'

import { signIn, expectSignedInAs } from '../../support/journeys.js'
import { waitForLogLine } from '../../support/app-log.js'
import { operatorUser, pendingRoleUser } from '../../support/users.js'

/**
 * Manual checklist phase 6 — the two ways a sign-in can end badly.
 *
 * "Could not sign you in" is for a failed authentication; "You do not have
 * access" is for a successful one that lacks the role. Keeping them distinct
 * matters: telling a user to try again when the real problem is a pending role
 * sends them round the loop forever.
 */
test.describe('Failure pages', { tag: '@auth' }, () => {
  test('shows a try-again page when Defra ID refuses, revealing no detail', async ({
    page,
    baseURL
  }) => {
    const response = await page.goto(
      '/auth/sign-in-oidc?error=access_denied&error_description=secret-detail'
    )

    expect(response.status()).toBe(401)
    await expect(
      page.getByRole('heading', { name: 'We could not sign you in' })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Try signing in again' })
    ).toBeVisible()

    // The OIDC detail is diagnostic information, not something to render
    expect(await page.content()).not.toContain('secret-detail')

    await waitForLogLine(baseURL, 'Defra ID sign-in failed')
  })

  test('shows the no-access page to a user whose role is still pending', async ({
    page
  }) => {
    await signIn(page, pendingRoleUser)
    await expectSignedInAs(page, pendingRoleUser)

    const response = await page.goto('/e2e/role-protected')

    expect(response.status()).toBe(403)
    await expect(
      page.getByRole('heading', {
        name: 'You do not have access to this service'
      })
    ).toBeVisible()
  })

  test('lets a user with the active role through the same page', async ({
    page
  }) => {
    await signIn(page, operatorUser)

    const response = await page.goto('/e2e/role-protected')

    expect(response.status()).toBe(200)
    await expect(page.getByTestId('e2e-page-heading')).toHaveText(
      'Role protected page'
    )
  })
})
