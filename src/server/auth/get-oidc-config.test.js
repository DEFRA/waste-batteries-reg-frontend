import { vi } from 'vitest'

import { config } from '#/config/config.js'

const discoveryUrl = config.get('defraId.discoveryUrl')

const validDoc = {
  issuer: 'https://test-idp.example',
  authorization_endpoint: 'https://test-idp.example/authorize',
  token_endpoint: 'https://test-idp.example/token',
  jwks_uri: 'https://test-idp.example/keys',
  end_session_endpoint: 'https://test-idp.example/logout'
}

async function importGetOidcConfig() {
  const authModule = await import('./get-oidc-config.js')
  return authModule.getOidcConfig
}

describe('#getOidcConfig', () => {
  beforeEach(() => {
    // The module caches the document — import fresh per test
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('Should fetch and return the discovery document', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(validDoc)))
    const getOidcConfig = await importGetOidcConfig()

    expect(await getOidcConfig()).toEqual(validDoc)
    expect(fetch).toHaveBeenCalledWith(discoveryUrl)
  })

  test('Should cache the document after the first fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(validDoc))
    vi.stubGlobal('fetch', fetchMock)
    const getOidcConfig = await importGetOidcConfig()

    await getOidcConfig()
    await getOidcConfig()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('Should throw when the discovery request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    )
    const getOidcConfig = await importGetOidcConfig()

    await expect(getOidcConfig()).rejects.toThrow(
      'Defra ID discovery failed: 503'
    )
  })

  test('Should throw when a required endpoint is missing', async () => {
    const { end_session_endpoint: _, ...incompleteDoc } = validDoc
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json(incompleteDoc))
    )
    const getOidcConfig = await importGetOidcConfig()

    await expect(getOidcConfig()).rejects.toThrow(
      'Defra ID discovery document missing "end_session_endpoint"'
    )
  })
})
