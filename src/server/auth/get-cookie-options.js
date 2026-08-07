import { config } from '#/config/config.js'
import { refreshTokens } from './refresh-tokens.js'
import { verifyToken } from './verify-token.js'
import { buildUserProfile } from './user-profile.js'

const refreshWindowMs = 60 * 1000

export function getCookieOptions() {
  return {
    cookie: {
      name: 'userSession',
      password: config.get('session.cookie.password'),
      path: '/',
      ttl: config.get('session.cookie.ttl'),
      isSecure: config.get('session.cookie.secure'),
      // Lax, not Strict — the cookie must survive the redirect back from the IdP
      isSameSite: 'Lax'
    },
    keepAlive: true,
    redirectTo: (request) =>
      `/auth/sign-in?redirect=${encodeURIComponent(request.url.pathname + request.url.search)}`,
    validate: async function (request, session) {
      const cached = await request.server.app.cache.get(session.sessionId)
      if (!cached) return { isValid: false }

      // Absolute cap from sign-in — token refresh and cookie keepAlive are
      // both rolling, so without this a session could live as long as the
      // refresh token (24 h). Fails closed on a missing/invalid createdAt.
      const ageMs = Date.now() - Date.parse(cached.createdAt)
      if (Number.isNaN(ageMs) || ageMs > config.get('session.absoluteTtl')) {
        await request.server.app.cache.drop(session.sessionId)
        return { isValid: false }
      }

      if (Date.parse(cached.expiresAt) - Date.now() > refreshWindowMs) {
        return { isValid: true, credentials: cached }
      }

      // Close to expiry — refresh proactively so no request fails on expiry
      try {
        const tokens = await refreshTokens(cached.refreshToken)
        const claims = await verifyToken(tokens.access_token)
        const updated = {
          ...cached,
          ...buildUserProfile(claims, tokens.id_token),
          accessToken: tokens.access_token,
          // B2C may not rotate the refresh token; keep the old one if it doesn't
          refreshToken: tokens.refresh_token ?? cached.refreshToken,
          expiresAt: new Date(
            Date.now() + Number(tokens.expires_in) * 1000
          ).toISOString()
        }
        await request.server.app.cache.set(session.sessionId, updated)
        return { isValid: true, credentials: updated }
      } catch (error) {
        request.logger.info(
          `Defra ID refresh failed, dropping session: ${error.message}`
        )
        await request.server.app.cache.drop(session.sessionId)
        return { isValid: false }
      }
    }
  }
}
