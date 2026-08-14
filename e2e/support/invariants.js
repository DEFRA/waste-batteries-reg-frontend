import { expect } from '@playwright/test'

/**
 * The four "must never see" invariants from the manual checklist, as assertions:
 * a JWT in any cookie value, anything auth-related in web storage, OIDC error
 * detail on an error page, token contents in the app's logs.
 *
 * Every journey that reaches a signed-in state calls these, because a leak is
 * far more likely to appear as a side effect of some other change than as a
 * failure of the thing being tested.
 */

/**
 * Three base64url segments — the shape of any JWT the app handles.
 *
 * The boundary lookarounds are what keep this linear: without them the engine
 * retries the whole pattern from every position inside a long run of word
 * characters, which is exactly what a log line or a cookie jar is full of.
 * They cost nothing in matching power — a real token still starts and ends at
 * a boundary, and any leading run is absorbed by the first segment anyway.
 */
const jwtPattern = /(?<![\w-])[\w-]{16,}\.[\w-]{16,}\.[\w-]{16,}(?![\w-])/

export const sessionCookieName = 'userSession'

export async function expectNoJwtInCookies(context) {
  const cookies = await context.cookies()

  for (const cookie of cookies) {
    expect(
      cookie.value,
      `cookie "${cookie.name}" looks like it contains a JWT`
    ).not.toMatch(jwtPattern)
  }
}

export async function expectNothingAuthRelatedInWebStorage(page) {
  const stored = await page.evaluate(() => ({
    local: { ...window.localStorage },
    session: { ...window.sessionStorage }
  }))

  const entries = [
    ...Object.entries(stored.local),
    ...Object.entries(stored.session)
  ]

  for (const [key, value] of entries) {
    expect(
      `${key}=${value}`,
      `web storage entry "${key}" looks auth-related`
    ).not.toMatch(/token|jwt|session|auth|bearer/i)
    expect(value).not.toMatch(jwtPattern)
  }
}

/** Cookies plus web storage — the browser-side half of the invariants. */
export async function expectNoTokensInBrowser(page) {
  await expectNoJwtInCookies(page.context())
  await expectNothingAuthRelatedInWebStorage(page)
}

export function expectNoTokensInLogs(logText) {
  const match = logText.match(jwtPattern)
  expect(match?.[0], 'the app logged something JWT-shaped').toBeUndefined()
}

export function expectNoJwt(value, description) {
  expect(value, description).not.toMatch(jwtPattern)
}

export function looksLikeAJwt(value) {
  return jwtPattern.test(value)
}
