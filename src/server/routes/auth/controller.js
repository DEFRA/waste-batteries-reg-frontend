import { randomUUID } from 'node:crypto'

import { config } from '#/config/config.js'
import { getOidcConfig } from '../../auth/get-oidc-config.js'
import { statusCodes } from '../../common/constants/status-codes.js'

export function signInController(_request, h) {
  return h.redirect('/')
}

export async function signInOidcController(request, h) {
  if (!request.auth.isAuthenticated) {
    // Log the OIDC detail, render none of it
    request.logger.warn(
      `Defra ID sign-in failed: ${request.auth.error?.message}`
    )
    return h
      .view('unauthorised/index', {
        pageTitle: 'We could not sign you in',
        heading: 'We could not sign you in'
      })
      .code(statusCodes.unauthorized)
  }

  const { profile, token, refreshToken, expiresIn } = request.auth.credentials
  const sessionId = randomUUID() // fresh id on every sign-in — prevents fixation

  await request.server.app.cache.set(sessionId, {
    ...profile,
    sessionId,
    accessToken: token,
    refreshToken,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + Number(expiresIn) * 1000).toISOString()
  })

  request.cookieAuth.set({ sessionId })
  request.logger.info(
    `User authenticated (correlationId ${profile.correlationId})`
  )

  return h.redirect(request.yar.flash('redirect')?.at(0) ?? '/')
}

export async function signOutController(request, h) {
  if (!request.auth.isAuthenticated) return h.redirect('/')

  const session = request.auth.credentials
  const oidcConfig = await getOidcConfig()

  // State so a third party can't forge the post-logout callback
  const state = randomUUID()
  request.yar.flash('signOutState', state)

  // Drop the local session now — the callback may never arrive
  await request.server.app.cache.drop(session.sessionId)
  request.cookieAuth.clear()

  const url = new URL(oidcConfig.end_session_endpoint)
  url.search = new URLSearchParams({
    id_token_hint: session.idToken,
    post_logout_redirect_uri: `${config.get('defraId.callbackBaseUrl')}/auth/sign-out-oidc`,
    state
  }).toString()

  return h.redirect(url.toString())
}

export function signOutOidcController(request, h) {
  const expected = request.yar.flash('signOutState')?.at(0)
  if (!expected || request.query.state !== expected) {
    request.logger.warn('Post-logout callback with unrecognised state')
  }

  // Fail-safe: the session is already gone; clear the cookie again
  request.cookieAuth.clear()
  return h.redirect('/')
}
