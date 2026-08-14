/**
 * Small helpers for the assertions that are about the HTTP exchange itself —
 * the redirect chain, the cookies set along the way — rather than about what
 * the rendered page says.
 */

/** All Set-Cookie headers, not just the last one `headers()` would collapse to. */
export function setCookieHeaders(response) {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => header.value)
}

export function setCookieHeaderFor(response, name) {
  return setCookieHeaders(response).find((value) =>
    value.startsWith(`${name}=`)
  )
}

/**
 * Parses a Location header into a URL, so query params can be asserted on.
 * Resolved against the request URL, because the app's own redirects are
 * relative paths while the ones to Defra ID are absolute.
 */
export function redirectTarget(response) {
  const location = response.headers().location

  if (!location) {
    throw new Error(
      `Expected a redirect but got ${response.status()} with no Location header`
    )
  }

  return new URL(location, response.url())
}

export async function findCookie(context, name) {
  const cookies = await context.cookies()
  return cookies.find((cookie) => cookie.name === name)
}
