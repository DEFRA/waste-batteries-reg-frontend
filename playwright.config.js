import { defineConfig, devices } from '@playwright/test'

import { appInstances } from './e2e/support/app-instances.js'

/**
 * End-to-end tests.
 *
 * Specs are grouped by area under e2e/journeys — everything so far is
 * e2e/journeys/auth, tagged `@auth`. A new area gets a new folder and tag:
 *
 *   npm run test:e2e -- --grep @auth      just the auth journeys
 *   npm run test:e2e -- --grep-invert @auth   everything else
 *
 * The auth journeys drive the real app against the real cdp-defra-id-stub, so
 * the stub must be running before `npm run test:e2e`:
 *
 *   docker compose up -d cdp-defra-id-stub
 *
 * Two journeys need the app configured differently — Redis-backed sessions, and
 * a session cap short enough for a test to outlive. Rather than restarting one
 * app with different environment variables mid-run, each variant is its own
 * instance on its own port, all started below. See e2e/support/app-instances.js.
 *
 * A spec that needs one of those says so itself, at the top of the file:
 *
 *   test.use({ baseURL: appInstances.sessionStore.url })
 *
 * Everything else uses relative paths and lands on the default instance.
 */
export default defineConfig({
  testDir: './e2e/journeys',
  globalSetup: './e2e/support/global-setup.js',
  // Sign-in is a multi-hop redirect journey against a shared stub; serial
  // execution inside a file keeps the stub's per-user state predictable
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60000,
  expect: { timeout: 10000 },

  use: {
    ...devices['Desktop Chrome'],
    // The instance a spec gets unless it declares another with test.use
    baseURL: appInstances.app.url,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The stub lives on a different origin; nothing here should ignore its certs
    ignoreHTTPSErrors: false
  },

  webServer: Object.values(appInstances).map((instance) => ({
    // Logs go to a file so tests can assert on them — one of the four
    // "must never see" invariants is "no token contents in the app's logs"
    command: `mkdir -p e2e/.logs && node e2e/support/test-server.js > ${instance.logFile} 2>&1`,
    url: `${instance.url}/health`,
    reuseExistingServer: false,
    timeout: 60000,
    env: instance.env
  }))
})
