import { execFileSync } from 'node:child_process'

import { test, expect } from '@playwright/test'

import {
  signInFromHeader,
  signOut,
  expectSignedInAs,
  expectSignedOut
} from '../../support/journeys.js'
import { containerisedAppUrl } from '../../support/app-instances.js'
import { containerisedUser } from '../../support/users.js'

/**
 * Manual checklist phase 11 — the app running inside compose.
 *
 * The stub advertises its endpoints as localhost:3200, which is right for the
 * browser but would mean the container itself without the
 * `extra_hosts: localhost:host-gateway` mapping. A completed sign-in is the
 * proof: discovery, the token exchange and the JWKS fetch all have to reach the
 * stub from inside the container.
 *
 * Playwright does not start this one. Bring it up with `docker compose up -d`;
 * otherwise the journey skips.
 */
// The compose service, not one of the instances Playwright starts
test.use({ baseURL: containerisedAppUrl })

async function isContainerisedAppRunning() {
  try {
    const response = await fetch(`${containerisedAppUrl}/health`)
    return response.ok
  } catch {
    return false
  }
}

function composeLogs() {
  try {
    return execFileSync('docker', ['compose', 'logs', 'frontend'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch {
    return null
  }
}

test.describe('Containerised app', { tag: '@auth' }, () => {
  test.beforeEach(async () => {
    test.skip(
      !(await isContainerisedAppRunning()),
      'The compose `frontend` service is not running (docker compose up -d)'
    )
  })

  test('starts without failing OIDC discovery', async () => {
    const logs = composeLogs()
    test.skip(logs === null, 'docker compose logs are unavailable')

    expect(logs).not.toContain('ECONNREFUSED')
  })

  test('completes a full sign-in and sign-out from inside the container', async ({
    page
  }) => {
    await signInFromHeader(page, containerisedUser)
    await expectSignedInAs(page, containerisedUser)

    await page.goto('/')
    await signOut(page)
    await expectSignedOut(page)
  })
})
