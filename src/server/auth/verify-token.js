import { createRemoteJWKSet, jwtVerify } from 'jose'

import { config } from '#/config/config.js'
import { getOidcConfig } from './get-oidc-config.js'

let jwks = null

async function getJwks() {
  if (!jwks) {
    const oidcConfig = await getOidcConfig()
    // Caches keys, refetches on unknown kid — handles B2C signing-key rotation
    jwks = createRemoteJWKSet(new URL(oidcConfig.jwks_uri))
  }
  return jwks
}

export async function verifyToken(token) {
  const oidcConfig = await getOidcConfig()
  const { payload } = await jwtVerify(token, await getJwks(), {
    issuer: oidcConfig.issuer,
    audience: config.get('defraId.clientId'),
    algorithms: ['RS256'],
    clockTolerance: 60
  })
  return payload
}
