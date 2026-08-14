/**
 * Entry point for the app instances the e2e suite drives.
 *
 * It is the real server — createServer() with nothing stubbed — plus, when
 * E2E_PROTECTED_ROUTES is set, two routes the app does not have yet:
 *
 *   /e2e/protected       relies on the server-wide auth default, so it proves
 *                        the "everything is protected unless it opts out"
 *                        behaviour and the redirect-to-sign-in that goes with it
 *   /e2e/role-protected  additionally requires a role scope, so it proves the
 *                        403 no-access page
 *
 * The manual checklist gets this coverage by asking a human to delete the
 * `auth: { mode: 'try' }` line from a real route and put it back afterwards.
 * Adding the routes here keeps the app's own routing honest.
 */
import process from 'node:process'

import { createServer } from '#/server/server.js'
import { config } from '#/config/config.js'

function page(title) {
  // The sign-out link mirrors the real layout's header, so the back-button
  // journey can leave a protected page the way a person would
  return `<!doctype html>
<html lang="en"><head><title>${title}</title></head>
<body>
  <h1 data-testid="e2e-page-heading">${title}</h1>
  <a href="/auth/sign-out">Sign out</a>
</body></html>`
}

const server = await createServer()

if (process.env.E2E_PROTECTED_ROUTES === 'true') {
  const requiredRole = process.env.E2E_REQUIRED_ROLE

  server.route([
    {
      method: 'GET',
      path: '/e2e/protected',
      // No auth options at all — inherits the server default
      handler: () => page('Protected page')
    },
    {
      method: 'GET',
      path: '/e2e/role-protected',
      options: { auth: { access: { scope: [requiredRole] } } },
      handler: () => page('Role protected page')
    }
  ])
}

await server.start()
server.logger.info(`e2e app listening on port ${config.get('port')}`)

process.on('unhandledRejection', (error) => {
  server.logger.error(error)
  process.exitCode = 1
})
