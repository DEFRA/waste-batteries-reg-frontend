import inert from '@hapi/inert'

import { config } from '#/config/config.js'
import { serveStaticFiles } from './serve-static-files.js'
import { statusCodes } from '../common/constants/status-codes.js'

/**
 * Serves static assets: vite middleware in local dev, built files otherwise.
 * Every asset route sets auth: false explicitly — the server-wide auth
 * default applies to all routes without their own auth config, whatever
 * order they were registered in.
 */
export const staticAssets = {
  plugin: {
    name: 'static-assets',
    async register(server) {
      await server.register([inert])

      if (!config.get('isProduction') && !config.get('isTest')) {
        const { createServer: createViteServer } = await import('vite')
        const { finished } = await import('node:stream/promises')

        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: 'custom'
        })

        server.route({
          method: '*',
          path: '/public/{param*}',
          options: { auth: false },
          handler: async (request, h) => {
            const { req, res } = request.raw

            // vite.middlewares is a connect app; mimic connect's mount-path
            // strip so vite sees paths relative to its /public base
            req.url = req.url.replace(/^\/public/, '') || '/'

            const { promise: next, resolve } = Promise.withResolvers()
            vite.middlewares(req, res, () => resolve(true))
            const nextCalled = await Promise.race([finished(res), next])

            if (nextCalled) {
              return h.response('Not found').code(statusCodes.notFound)
            }
            return h.abandon
          }
        })
      } else {
        await server.register(serveStaticFiles)
      }
    }
  }
}
