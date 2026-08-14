/**
 * Client for the local cdp-defra-id-stub — the identity provider the e2e suite
 * signs in against. Registration is keyed on userId, so re-registering the same
 * fixture is an overwrite rather than a duplicate.
 */

export const stubOrigin = 'http://localhost:3200'
export const stubBasePath = '/cdp-defra-id-stub'
export const stubBaseUrl = `${stubOrigin}${stubBasePath}`
export const discoveryUrl = `${stubBaseUrl}/.well-known/openid-configuration`

async function stubRequest(path, options = {}) {
  const response = await fetch(`${stubBaseUrl}${path}`, options)

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Defra ID stub ${options.method ?? 'GET'} ${path} failed: ${response.status} ${body}`
    )
  }

  return response
}

export async function fetchDiscoveryDocument() {
  const response = await fetch(discoveryUrl)
  if (!response.ok) {
    throw new Error(
      `Defra ID stub discovery failed (${response.status}). Is it running? ` +
        '`docker compose up -d cdp-defra-id-stub`'
    )
  }
  return response.json()
}

export async function isStubRunning() {
  try {
    await fetchDiscoveryDocument()
    return true
  } catch {
    return false
  }
}

/** Creates, or overwrites, a stub registration. */
export async function registerUser(user) {
  const response = await stubRequest('/API/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      loa: '1',
      aal: '1',
      enrolmentCount: user.relationships.length,
      enrolmentRequestCount: user.relationships.length,
      relationships: user.relationships.map((relationship) => ({
        organisationName: relationship.organisationName,
        relationshipRole: 'Employee',
        roleName: relationship.roleName,
        roleStatus: relationship.roleStatus
      }))
    })
  })

  return response.json()
}

export async function registerUsers(users) {
  for (const user of users) {
    await registerUser(user)
  }
}
