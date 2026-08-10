import { createServer } from './server.js'

describe('#createServer', () => {
  let server

  beforeAll(async () => {
    server = await createServer()

    // Routes registered after the auth plugin, with no auth options, to prove
    // the server-wide default protects them
    server.route({
      method: 'GET',
      path: '/test/protected',
      handler: () => 'protected content'
    })
    server.route({
      method: 'GET',
      path: '/test/scoped',
      options: { auth: { access: { scope: ['admin'] } } },
      handler: () => 'scoped content'
    })

    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('Defra ID auth session cache', () => {
    test('Should store and retrieve a session via the defra-id-session segment', async () => {
      await server.app.cache.set('test-session-id', { userId: 'user-123' })

      expect(await server.app.cache.get('test-session-id')).toEqual({
        userId: 'user-123'
      })
    })

    test('Should return null for an unknown session id', async () => {
      expect(await server.app.cache.get('unknown-session-id')).toBeNull()
    })
  })

  describe('Route protection default', () => {
    test('Should redirect a signed-out user to sign-in with the original path', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/test/protected'
      })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe(
        '/auth/sign-in?redirect=%2Ftest%2Fprotected'
      )
    })

    test('Should serve a protected route to an authenticated user', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/test/protected',
        auth: {
          strategy: 'session',
          credentials: { sessionId: 'sid', scope: ['user'] }
        }
      })

      expect(statusCode).toBe(200)
      expect(result).toBe('protected content')
    })

    test('Should render the no-access page when the required scope is missing', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/test/scoped',
        auth: {
          strategy: 'session',
          credentials: { sessionId: 'sid', scope: ['user'] }
        }
      })

      expect(statusCode).toBe(403)
      expect(result).toContain('You do not have access to this service')
    })

    test('Should keep /health public', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/health'
      })

      expect(statusCode).toBe(200)
    })

    test('Should keep public pages available signed out', async () => {
      const { statusCode } = await server.inject({ method: 'GET', url: '/' })

      expect(statusCode).toBe(200)
    })
  })

  describe('no-store cache headers', () => {
    test('Should set no-store on authenticated responses', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/test/protected',
        auth: {
          strategy: 'session',
          credentials: { sessionId: 'sid', scope: ['user'] }
        }
      })

      expect(headers['cache-control']).toBe('no-store')
    })

    test('Should not set no-store on unauthenticated responses', async () => {
      const { headers } = await server.inject({ method: 'GET', url: '/' })

      expect(headers['cache-control']).not.toBe('no-store')
    })
  })
})
