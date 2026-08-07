import { vi } from 'vitest'

import { getCookieOptions } from './get-cookie-options.js'
import { refreshTokens } from './refresh-tokens.js'
import { verifyToken } from './verify-token.js'

vi.mock('./refresh-tokens.js', () => ({ refreshTokens: vi.fn() }))
vi.mock('./verify-token.js', () => ({ verifyToken: vi.fn() }))

function buildRequest(cached) {
  return {
    server: {
      app: {
        cache: {
          get: vi.fn().mockResolvedValue(cached),
          set: vi.fn(),
          drop: vi.fn()
        }
      }
    },
    logger: { info: vi.fn() }
  }
}

describe('#getCookieOptions', () => {
  const options = getCookieOptions()

  test('Should use a Lax session cookie', () => {
    expect(options.cookie.isSameSite).toBe('Lax')
    expect(options.cookie.name).toBe('userSession')
  })

  test('Should redirect to sign-in with the original path preserved', () => {
    const request = { url: { pathname: '/tasks/42', search: '?tab=all' } }

    expect(options.redirectTo(request)).toBe(
      '/auth/sign-in?redirect=%2Ftasks%2F42%3Ftab%3Dall'
    )
  })

  describe('validate', () => {
    test('Should be invalid when the session is not in the cache', async () => {
      const request = buildRequest(null)

      expect(await options.validate(request, { sessionId: 'gone' })).toEqual({
        isValid: false
      })
    })

    test('Should be valid without refresh when not near expiry', async () => {
      const cached = {
        sessionId: 'sid',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
      const request = buildRequest(cached)

      expect(await options.validate(request, { sessionId: 'sid' })).toEqual({
        isValid: true,
        credentials: cached
      })
      expect(refreshTokens).not.toHaveBeenCalled()
    })

    test('Should refresh and update the cached session when near expiry', async () => {
      const cached = {
        sessionId: 'sid',
        refreshToken: 'old-refresh',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 1000).toISOString()
      }
      const request = buildRequest(cached)
      refreshTokens.mockResolvedValue({
        access_token: 'new-access',
        id_token: 'new-id-token',
        expires_in: 3600
        // no refresh_token — B2C may not rotate it
      })
      verifyToken.mockResolvedValue({ sub: 'user-123' })

      const result = await options.validate(request, { sessionId: 'sid' })

      expect(refreshTokens).toHaveBeenCalledWith('old-refresh')
      expect(result.isValid).toBe(true)
      expect(result.credentials).toMatchObject({
        accessToken: 'new-access',
        refreshToken: 'old-refresh', // kept, since none was returned
        idToken: 'new-id-token'
      })
      expect(request.server.app.cache.set).toHaveBeenCalledWith(
        'sid',
        result.credentials
      )
    })

    test('Should drop the session once past the absolute session ttl', async () => {
      const cached = {
        sessionId: 'sid',
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
      const request = buildRequest(cached)

      expect(await options.validate(request, { sessionId: 'sid' })).toEqual({
        isValid: false
      })
      expect(request.server.app.cache.drop).toHaveBeenCalledWith('sid')
      expect(refreshTokens).not.toHaveBeenCalled()
    })

    test('Should treat a session without createdAt as expired', async () => {
      const cached = {
        sessionId: 'sid',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
      const request = buildRequest(cached)

      expect(await options.validate(request, { sessionId: 'sid' })).toEqual({
        isValid: false
      })
      expect(request.server.app.cache.drop).toHaveBeenCalledWith('sid')
    })

    test('Should drop the session when refresh fails', async () => {
      const cached = {
        sessionId: 'sid',
        refreshToken: 'expired-refresh',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString()
      }
      const request = buildRequest(cached)
      refreshTokens.mockRejectedValue(new Error('invalid_grant'))

      expect(await options.validate(request, { sessionId: 'sid' })).toEqual({
        isValid: false
      })
      expect(request.server.app.cache.drop).toHaveBeenCalledWith('sid')
    })
  })
})
