import {
  signInController,
  signInOidcController,
  signOutController,
  signOutOidcController
} from './controller.js'

/**
 * Sets up the Defra ID auth routes.
 * These routes are registered in src/server/plugins/router.js.
 */
export const authRoutes = {
  plugin: {
    name: 'auth-routes',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/auth/sign-in',
          // Bell intercepts and redirects to Defra ID; the handler only runs
          // if the user arrives here already authenticated
          options: { auth: 'defra-id' },
          handler: signInController
        },
        {
          method: 'GET',
          path: '/auth/sign-in-oidc',
          options: { auth: { strategy: 'defra-id', mode: 'try' } },
          handler: signInOidcController
        },
        {
          method: 'GET',
          path: '/auth/sign-out',
          options: { auth: { strategy: 'session', mode: 'try' } },
          handler: signOutController
        },
        {
          method: 'GET',
          path: '/auth/sign-out-oidc',
          options: { auth: false },
          handler: signOutOidcController
        },
        {
          method: 'GET',
          // Organisation re-selection; providerParams adds forceReselection
          path: '/auth/organisation',
          options: { auth: 'defra-id' },
          handler: signInController
        }
      ])
    }
  }
}
