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
    vi.useRealTimers()
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

  test('Should retry and succeed when the provider is not ready yet', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockImplementation(() => Response.json(validDoc))
    vi.stubGlobal('fetch', fetchMock)
    const getOidcConfig = await importGetOidcConfig()

    vi.useFakeTimers()
    const result = getOidcConfig()
    await vi.runAllTimersAsync()

    expect(await result).toEqual(validDoc)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test('Should throw when the discovery request fails on every attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const getOidcConfig = await importGetOidcConfig()

    vi.useFakeTimers()
    const assertion = expect(getOidcConfig()).rejects.toThrow(
      'Defra ID discovery failed: 503'
    )
    await vi.runAllTimersAsync()

    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(5)
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
