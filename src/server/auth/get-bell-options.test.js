import { vi } from 'vitest'

import { config } from '#/config/config.js'
import { getBellOptions } from './get-bell-options.js'
import { verifyToken } from './verify-token.js'

vi.mock('./verify-token.js', () => ({
  verifyToken: vi.fn()
}))

const oidcConfig = {
  authorization_endpoint: 'https://test-idp.example/authorize',
  token_endpoint: 'https://test-idp.example/token'
}

describe('#getBellOptions', () => {
  const options = getBellOptions(oidcConfig)

  test('Should configure the provider from the discovery document', () => {
    expect(options.provider).toMatchObject({
      protocol: 'oauth2',
      useParamsAuth: true,
      auth: oidcConfig.authorization_endpoint,
      token: oidcConfig.token_endpoint
    })
  })

  test('Should request the configured scopes', () => {
    expect(options.provider.scope).toEqual(config.get('defraId.scopes'))
  })

  test('Should use Lax cookies so the transaction survives the IdP redirect', () => {
    expect(options.isSameSite).toBe('Lax')
  })

  describe('providerParams', () => {
    test('Should send serviceId and no response_mode (the stub rejects it)', () => {
      expect(options.providerParams({ path: '/auth/sign-in' })).toEqual({
        serviceId: config.get('defraId.serviceId')
      })
    })

    test('Should force organisation reselection on the organisation route', () => {
      expect(
        options.providerParams({ path: '/auth/organisation' })
      ).toMatchObject({ forceReselection: true })
    })
  })

  describe('location', () => {
    test('Should store a safe redirect in yar and return the callback URL', () => {
      const request = {
        query: { redirect: '/some/page' },
        yar: { flash: vi.fn() }
      }

      expect(options.location(request)).toBe(
        `${config.get('defraId.callbackBaseUrl')}/auth/sign-in-oidc`
      )
      expect(request.yar.flash).toHaveBeenCalledWith('redirect', '/some/page')
    })

    test('Should neutralise an unsafe redirect', () => {
      const request = {
        query: { redirect: '//evil.example' },
        yar: { flash: vi.fn() }
      }

      options.location(request)

      expect(request.yar.flash).toHaveBeenCalledWith('redirect', '/')
    })
  })

  describe('profile', () => {
    test('Should verify the access token and build the user profile', async () => {
      verifyToken.mockResolvedValue({
        sub: 'user-123',
        firstName: 'Jo',
        lastName: 'Bloggs'
      })
      const credentials = { token: 'access-token' }

      await options.provider.profile(credentials, { id_token: 'id-token' })

      expect(verifyToken).toHaveBeenCalledWith('access-token')
      expect(credentials.profile).toMatchObject({
        id: 'user-123',
        displayName: 'Jo Bloggs',
        idToken: 'id-token',
        scope: ['user']
      })
    })

    test('Should propagate verification failure', async () => {
      verifyToken.mockRejectedValue(new Error('invalid signature'))

      await expect(
        options.provider.profile({ token: 'tampered' }, {})
      ).rejects.toThrow('invalid signature')
    })
  })
})
