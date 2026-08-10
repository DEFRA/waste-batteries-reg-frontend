import bell from '@hapi/bell'
import cookie from '@hapi/cookie'

import { getOidcConfig } from '../auth/get-oidc-config.js'
import { getBellOptions } from '../auth/get-bell-options.js'
import { getCookieOptions } from '../auth/get-cookie-options.js'

/**
 * Registers the two Defra ID auth strategies:
 * - defra-id (bell): the OIDC redirect + code exchange, used only on auth routes
 * - session (cookie): cookie-backed session validation with token refresh
 *
 * Every route registered after this plugin is authenticated by default —
 * public routes must opt out explicitly (auth: false or mode: 'try').
 */
export const auth = {
  plugin: {
    name: 'auth',
    register: async function (server) {
      await server.register([bell, cookie])
      const oidcConfig = await getOidcConfig()
      server.auth.strategy('defra-id', 'bell', getBellOptions(oidcConfig))
      server.auth.strategy('session', 'cookie', getCookieOptions())
      server.auth.default('session')
    }
  }
}
