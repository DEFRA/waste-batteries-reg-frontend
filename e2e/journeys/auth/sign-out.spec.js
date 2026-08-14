import { test, expect } from '@playwright/test'

import { signIn, signOut, expectSignedOut } from '../../support/journeys.js'
import {
  looksLikeAJwt,
  sessionCookieName,
  expectNoTokensInBrowser
} from '../../support/invariants.js'
import {
  findCookie,
  redirectTarget,
  setCookieHeaderFor
} from '../../support/http.js'
import { waitForLogLine } from '../../support/app-log.js'
import { operatorUser } from '../../support/users.js'

/**
 * Manual checklist phase 5 — signing out, including the parts of it that only
 * exist to stop a third party forging the post-logout callback.
 */
test.describe('Sign-out journey', { tag: '@auth' }, () => {
  test('destroys the local session before handing off to Defra ID', async ({
    page,
    baseURL
  }) => {
    await signIn(page, operatorUser)

    // Issued from the page's own context, so it carries the real session
    const response = await page.request.get('/auth/sign-out', {
      maxRedirects: 0
    })

    expect(response.status()).toBe(302)

    const target = redirectTarget(response)
    expect(target.pathname).toContain('/logout')
    expect(target.searchParams.get('post_logout_redirect_uri')).toBe(
      `${baseURL}/auth/sign-out-oidc`
    )
    expect(target.searchParams.get('state')).toBeTruthy()

    // The one place a JWT legitimately appears in a URL
    expect(looksLikeAJwt(target.searchParams.get('id_token_hint'))).toBe(true)

    // Cleared on the way out, not on the way back — the callback may never come
    const cleared = setCookieHeaderFor(response, sessionCookieName)
    expect(cleared).toBeDefined()
    expect(cleared).toContain('Max-Age=0')
  })

  test('returns the user to a signed-out home page', async ({
    page,
    baseURL
  }) => {
    await signIn(page, operatorUser)
    await page.goto('/')

    await signOut(page)

    await expect(page).toHaveURL(`${baseURL}/`)
    await expectSignedOut(page)
    expect(await findCookie(page.context(), sessionCookieName)).toBeUndefined()
    await expectNoTokensInBrowser(page)
  })

  test('ignores a forged post-logout callback', async ({ page, baseURL }) => {
    await page.goto('/auth/sign-out-oidc?state=garbage')

    await expect(page).toHaveURL(`${baseURL}/`)
    await expectSignedOut(page)
    await waitForLogLine(
      baseURL,
      'Post-logout callback with unrecognised state'
    )
  })
})
