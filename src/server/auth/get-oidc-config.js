import { config } from '#/config/config.js'

let cached = null

export async function getOidcConfig() {
  if (cached) return cached

  const url = config.get('defraId.discoveryUrl')
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Defra ID discovery failed: ${response.status} from ${url}`)
  }

  const doc = await response.json()
  const required = [
    'issuer',
    'authorization_endpoint',
    'token_endpoint',
    'jwks_uri',
    'end_session_endpoint'
  ]
  for (const key of required) {
    if (!doc[key]) {
      throw new Error(`Defra ID discovery document missing "${key}"`)
    }
  }

  cached = doc
  return cached
}
