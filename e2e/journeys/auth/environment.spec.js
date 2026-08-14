import { test, expect } from '@playwright/test'

import { fetchDiscoveryDocument, stubBaseUrl } from '../../support/stub.js'
import { allUsers } from '../../support/users.js'

/**
 * Manual checklist phase 0 (environment up) and phase 12 (what the stub has
 * registered).
 *
 * These run first because every other journey's failure mode looks the same
 * when the identity provider is missing: a blank page and a timeout.
 */
test.describe('Environment', { tag: '@auth' }, () => {
  test('the identity provider publishes the endpoints the app discovers at startup', async () => {
    const discovery = await fetchDiscoveryDocument()

    expect(discovery).toMatchObject({
      authorization_endpoint: expect.stringContaining('/authorize'),
      token_endpoint: expect.stringContaining('/token'),
      jwks_uri: expect.stringContaining('/jwks.json'),
      end_session_endpoint: expect.stringContaining('/logout')
    })
  })

  test('the app is up and serving its health check', async ({ request }) => {
    const response = await request.get('/health')

    expect(response.status()).toBe(200)
  })

  test('every test user is registered at the identity provider', async ({
    request
  }) => {
    // The stub's sign-in page doubles as its list of registrations, which is
    // what the manual checklist scans DynamoDB for
    const response = await request.get(`${stubBaseUrl}/authorize`, {
      params: {
        client_id: '63983fc2-cfff-45bb-8ec2-959e21062b9a',
        response_type: 'code',
        redirect_uri: 'http://localhost:3100/auth/sign-in-oidc',
        scope: 'openid offline_access',
        state: 'environment-check',
        serviceId: 'stub-service-id'
      }
    })
    const body = await response.text()

    for (const user of allUsers) {
      expect(body, `${user.email} is not registered`).toContain(user.email)
    }
  })
})
