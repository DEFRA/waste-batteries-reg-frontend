import { defineConfig, devices } from '@playwright/test'

import {
  appInstances,
  containerisedAppUrl
} from './e2e/support/app-instances.js'

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
 * instance on its own port and each project points at the instance it needs.
 * See e2e/support/app-instances.js.
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
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The stub lives on a different origin; nothing here should ignore its certs
    ignoreHTTPSErrors: false
  },

  /**
   * Projects say WHICH APP a spec runs against, not what it is about. What a
   * spec is about comes from the folder it lives in under e2e/journeys and the
   * tag on its describe — `--grep @auth` for everything auth, and a new area
   * gets its own folder and tag without touching this list.
   *
   * Only the handful of specs that need a differently configured app name
   * themselves here; everything else runs against the default instance.
   */
  projects: [
    {
      name: 'default-app',
      use: { ...devices['Desktop Chrome'], baseURL: appInstances.app.url },
      testIgnore: [
        '**/session-store.spec.js',
        '**/absolute-session-ttl.spec.js',
        '**/containerised.spec.js'
      ]
    },
    {
      name: 'redis-sessions',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: appInstances.sessionStore.url
      },
      testMatch: ['**/session-store.spec.js']
    },
    {
      name: 'short-session-cap',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: appInstances.shortAbsoluteTtl.url
      },
      testMatch: ['**/absolute-session-ttl.spec.js']
    },
    {
      name: 'containerised-app',
      use: { ...devices['Desktop Chrome'], baseURL: containerisedAppUrl },
      testMatch: ['**/containerised.spec.js']
    }
  ],

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
