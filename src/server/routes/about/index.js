import { aboutController } from './controller.js'

/**
 * Sets up the routes used in the /about page.
 * These routes are registered in src/server/router.js.
 */
export const about = {
  plugin: {
    name: 'about',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/about',
          // Public page — renders signed in or out, nav reflects auth state
          options: { auth: { mode: 'try' } },
          ...aboutController
        }
      ])
    }
  }
}
