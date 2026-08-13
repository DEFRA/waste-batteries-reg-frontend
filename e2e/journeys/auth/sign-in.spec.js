import { test, expect } from '@playwright/test'

import {
  signInFromHeader,
  expectSignedInAs,
  expectAtIdentityProvider
} from '../../support/journeys.js'
import {
  expectNoTokensInBrowser,
  expectNoTokensInLogs,
  looksLikeAJwt,
  sessionCookieName
} from '../../support/invariants.js'
import {
  findCookie,
  redirectTarget,
  setCookieHeaderFor
} from '../../support/http.js'
import { readAppLog, waitForLogLine } from '../../support/app-log.js'
import { operatorUser } from '../../support/users.js'

/**
 * Manual checklist phase 2 — the main event.
 *
 * Split in two: the outbound authorize request, which is easiest to assert on
 * as a raw 302, and the journey a person actually takes.
 */
test.describe('Sign-in journey', { tag: '@auth' }, () => {
  test('sends Defra ID an authorize request with the parameters it requires', async ({
    request
  }) => {
    const response = await request.get('/auth/sign-in', { maxRedirects: 0 })

    expect(response.status()).toBe(302)

    const target = redirectTarget(response)
    expect(target.origin).toBe('http://localhost:3200')
    expect(target.pathname).toContain('/authorize')

    expect(target.searchParams.get('serviceId')).toBe('stub-service-id')
    expect(target.searchParams.get('client_id')).toBe(
      '63983fc2-cfff-45bb-8ec2-959e21062b9a'
    )
    expect(target.searchParams.get('scope')).toBe('openid offline_access')
    expect(target.searchParams.get('response_type')).toBe('code')
    expect(target.searchParams.get('state')).toBeTruthy()

    // The stub rejects an explicit response_mode, and the code flow returns
    // via the query string by default anyway
    expect(target.searchParams.has('response_mode')).toBe(false)

    // The OAuth transaction cookie has to survive the redirect back from the
    // identity provider, so it cannot be SameSite=Strict
    const transactionCookie = setCookieHeaderFor(response, 'bell-defra-id')
    expect(transactionCookie).toBeDefined()
    expect(transactionCookie).toContain('SameSite=Lax')
  })

  test('takes a user from the header link to a signed-in home page', async ({
    page
  }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Sign in' }).click()
    await expectAtIdentityProvider(page)

    await page
      .getByRole('row', { name: operatorUser.email })
      .getByRole('link', { name: 'Log in' })
      .click()

    await page.waitForURL('**/')
    await expectSignedInAs(page, operatorUser)
  })

  test('stores the session in an opaque cookie, never a token in the browser', async ({
    page,
    baseURL
  }) => {
    await signInFromHeader(page, operatorUser)

    const sessionCookie = await findCookie(page.context(), sessionCookieName)

    expect(sessionCookie).toBeDefined()
    expect(sessionCookie.httpOnly).toBe(true)
    expect(sessionCookie.sameSite).toBe('Lax')
    expect(sessionCookie.path).toBe('/')
    expect(
      looksLikeAJwt(sessionCookie.value),
      'the session cookie should be an opaque encrypted blob'
    ).toBe(false)

    // Bell's transaction cookie is finished with once the callback completes
    expect(await findCookie(page.context(), 'bell-defra-id')).toBeUndefined()

    await expectNoTokensInBrowser(page)
    expectNoTokensInLogs(await readAppLog(baseURL))
  })

  test('marks authenticated pages no-store and logs the sign-in without tokens', async ({
    page,
    baseURL
  }) => {
    await signInFromHeader(page, operatorUser)

    const response = await page.goto('/')
    expect(response.headers()['cache-control']).toBe('no-store')

    const log = await waitForLogLine(baseURL, 'User authenticated')
    expect(log).toContain('correlationId')
    expectNoTokensInLogs(log)
  })
})
