import { config } from '#/config/config.js'
import { getOidcConfig } from './get-oidc-config.js'

export async function refreshTokens(refreshToken) {
  const oidcConfig = await getOidcConfig()

  // Credentials in the form-encoded body, never the query string (URLs leak into logs)
  const response = await fetch(oidcConfig.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.get('defraId.clientId'),
      client_secret: config.get('defraId.clientSecret'),
      grant_type: 'refresh_token',
      scope: config.get('defraId.scopes').join(' '),
      refresh_token: refreshToken
    })
  })

  if (!response.ok) {
    throw new Error(`Defra ID token refresh failed: ${response.status}`)
  }
  return response.json()
}
