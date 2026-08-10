import { createServer } from '../../server.js'
import { testOidcConfig } from '#/test-helpers/oidc-stub.js'

describe('auth routes', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('GET /auth/sign-in', () => {
    test('Should redirect to Defra ID with the required parameters', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/sign-in'
      })

      expect(statusCode).toBe(302)

      const location = new URL(headers.location)
      expect(location.origin + location.pathname).toBe(
        testOidcConfig.authorization_endpoint
      )
      expect(location.searchParams.get('serviceId')).toBe('stub-service-id')
      expect(location.searchParams.get('client_id')).toBe(
        '63983fc2-cfff-45bb-8ec2-959e21062b9a'
      )
      expect(location.searchParams.get('response_mode')).toBeNull()
      expect(location.searchParams.get('response_type')).toBe('code')
      expect(location.searchParams.get('scope')).toBe('openid offline_access')
      expect(location.searchParams.get('state')).toBeTruthy()
    })
  })

  describe('GET /auth/organisation', () => {
    test('Should force organisation reselection', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/auth/organisation'
      })

      const location = new URL(headers.location)
      expect(location.searchParams.get('forceReselection')).toBe('true')
    })
  })

  describe('GET /auth/sign-in-oidc', () => {
    test('Should render the unauthorised page when Defra ID reports an error', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/auth/sign-in-oidc?error=access_denied&error_description=cancelled'
      })

      expect(statusCode).toBe(401)
      expect(result).toContain('We could not sign you in')
    })

    test('Should create a session and redirect home on successful sign-in', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/sign-in-oidc',
        auth: {
          strategy: 'defra-id',
          credentials: {
            token: 'access-token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
            profile: {
              id: 'user-123',
              displayName: 'Jo Bloggs',
              correlationId: 'corr-1',
              scope: ['user']
            }
          }
        }
      })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/')

      const sessionCookie = headers['set-cookie'].find((cookie) =>
        cookie.startsWith('userSession=')
      )
      expect(sessionCookie).toContain('HttpOnly')
      expect(sessionCookie).toContain('SameSite=Lax')
    })
  })

  describe('GET /auth/sign-out', () => {
    test('Should redirect home when there is no session', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/sign-out'
      })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/')
    })

    test('Should drop the session and redirect to the IdP end session endpoint', async () => {
      await server.app.cache.set('session-1', { sessionId: 'session-1' })

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/sign-out',
        auth: {
          strategy: 'session',
          credentials: { sessionId: 'session-1', idToken: 'id-token-value' }
        }
      })

      expect(statusCode).toBe(302)

      const location = new URL(headers.location)
      expect(location.origin + location.pathname).toBe(
        testOidcConfig.end_session_endpoint
      )
      expect(location.searchParams.get('id_token_hint')).toBe('id-token-value')
      expect(location.searchParams.get('post_logout_redirect_uri')).toBe(
        'http://localhost:3000/auth/sign-out-oidc'
      )
      expect(location.searchParams.get('state')).toBeTruthy()

      expect(await server.app.cache.get('session-1')).toBeNull()
    })
  })

  describe('GET /auth/sign-out-oidc', () => {
    test('Should clear the session cookie and redirect home, even with an unrecognised state', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/sign-out-oidc?state=not-ours'
      })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/')

      const sessionCookie = headers['set-cookie'].find((cookie) =>
        cookie.startsWith('userSession=')
      )
      expect(sessionCookie).toContain('Max-Age=0')
    })
  })
})
