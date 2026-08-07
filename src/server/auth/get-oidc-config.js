import { config } from '#/config/config.js'

let cached = null

const maxAttempts = 5
const retryDelayMs = 2000

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchDiscoveryDocument(url) {
  let lastError

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(
          `Defra ID discovery failed: ${response.status} from ${url}`
        )
      }
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) await wait(retryDelayMs)
    }
  }

  throw lastError
}

export async function getOidcConfig() {
  if (cached) return cached

  const url = config.get('defraId.discoveryUrl')
  const doc = await fetchDiscoveryDocument(url)
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
