import { vi } from 'vitest'

import { config } from '#/config/config.js'
import { refreshTokens } from './refresh-tokens.js'

vi.mock('./get-oidc-config.js', () => ({
  getOidcConfig: vi.fn().mockResolvedValue({
    token_endpoint: 'https://test-idp.example/token'
  })
}))

const clientId = config.get('defraId.clientId')
const clientSecret = config.get('defraId.clientSecret')

describe('#refreshTokens', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('Should POST a form-encoded refresh request with no credentials in the URL', async () => {
    const tokens = {
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600
    }
    const fetchMock = vi.fn().mockResolvedValue(Response.json(tokens))
    vi.stubGlobal('fetch', fetchMock)

    expect(await refreshTokens('old-refresh')).toEqual(tokens)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://test-idp.example/token')
    expect(options.method).toBe('POST')
    expect(options.headers['content-type']).toBe(
      'application/x-www-form-urlencoded'
    )
    expect(options.body.get('grant_type')).toBe('refresh_token')
    expect(options.body.get('refresh_token')).toBe('old-refresh')
    expect(options.body.get('client_id')).toBe(clientId)
    expect(options.body.get('client_secret')).toBe(clientSecret)
    expect(options.body.get('scope')).toBe('openid offline_access')
    expect(String(url)).not.toContain(clientSecret)
    expect(String(url)).not.toContain('old-refresh')
  })

  test('Should throw when the token endpoint rejects the refresh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 400 }))
    )

    await expect(refreshTokens('expired-refresh')).rejects.toThrow(
      'Defra ID token refresh failed: 400'
    )
  })
})
