import { vi } from 'vitest'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'

import { config } from '#/config/config.js'
import { verifyToken } from './verify-token.js'

vi.mock('./get-oidc-config.js', () => ({
  getOidcConfig: vi.fn().mockResolvedValue({
    issuer: 'https://test-idp.example',
    jwks_uri: 'https://test-idp.example/keys'
  })
}))

const issuer = 'https://test-idp.example'
const clientId = config.get('defraId.clientId')
const nowInSeconds = () => Math.floor(Date.now() / 1000)

describe('#verifyToken', () => {
  let privateKey
  let wrongPrivateKey

  beforeAll(async () => {
    const keyPair = await generateKeyPair('RS256')
    privateKey = keyPair.privateKey
    wrongPrivateKey = (await generateKeyPair('RS256')).privateKey

    const jwk = await exportJWK(keyPair.publicKey)
    jwk.kid = 'test-kid'
    jwk.alg = 'RS256'
    jwk.use = 'sig'

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ keys: [jwk] }))
    )
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  function signToken({
    key = privateKey,
    kid = 'test-kid',
    aud = clientId,
    iss = issuer,
    expiresAt = nowInSeconds() + 300,
    claims = {}
  } = {}) {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer(iss)
      .setAudience(aud)
      .setIssuedAt(nowInSeconds() - 10)
      .setExpirationTime(expiresAt)
      .sign(key)
  }

  test('Should return the payload of a valid token', async () => {
    const token = await signToken({ claims: { firstName: 'Test' } })

    expect(await verifyToken(token)).toMatchObject({
      firstName: 'Test',
      iss: issuer,
      aud: clientId
    })
  })

  test('Should reject a token signed with the wrong key', async () => {
    const token = await signToken({ key: wrongPrivateKey })

    await expect(verifyToken(token)).rejects.toThrow(
      'signature verification failed'
    )
  })

  test('Should reject a token with the wrong audience', async () => {
    const token = await signToken({ aud: 'another-client' })

    await expect(verifyToken(token)).rejects.toThrow('"aud" claim')
  })

  test('Should reject a token with the wrong issuer', async () => {
    const token = await signToken({ iss: 'https://evil-idp.example' })

    await expect(verifyToken(token)).rejects.toThrow('"iss" claim')
  })

  test('Should reject an expired token', async () => {
    const token = await signToken({ expiresAt: nowInSeconds() - 7200 })

    await expect(verifyToken(token)).rejects.toThrow('"exp" claim')
  })

  test('Should reject a token with an unknown kid', async () => {
    const token = await signToken({ kid: 'unknown-kid' })

    await expect(verifyToken(token)).rejects.toThrow()
  })
})
