/**
 * The app instances Playwright starts, and the environment each one runs with.
 *
 * Shared by playwright.config.js (to launch them) and by the specs (to find the
 * matching log file for a baseURL).
 */

/**
 * Roles used by the e2e-only protected routes, and by the test users. Kept
 * here so test-server.js and users.js cannot drift apart.
 */
export const wasteOperatorRole = 'Waste operator'

/**
 * Absolute TTL used by the short-lived-session instance.
 *
 * The cap is measured from sign-in, so a test only has to browse once inside
 * this window and then wait it out. Kept as short as that allows: the waiting
 * is dead time in every run, and a test that sits idle for tens of seconds is
 * also the one that breaks when a laptop suspends mid-run.
 */
export const shortAbsoluteTtlMs = 8000

/**
 * Slack allowed for the app to notice the cap has passed, so the assertion is
 * not racing the expiry it is waiting on.
 */
const capExpiryMarginMs = 1500

/** Margin added to the cap before asserting the session has gone. */
export const pastTheCapMs = shortAbsoluteTtlMs + capExpiryMarginMs

const baseEnv = {
  // NODE_ENV=test skips the in-process Vite dev server (three of those would be
  // needlessly heavy) and keeps cookies non-secure over plain http
  NODE_ENV: 'test',
  LOG_ENABLED: 'true',
  LOG_FORMAT: 'ecs',
  LOG_LEVEL: 'info',
  SESSION_COOKIE_SECURE: 'false',
  // The app has no protected route of its own yet — home and about are
  // deliberately public — so the harness adds two. See test-server.js
  E2E_PROTECTED_ROUTES: 'true',
  E2E_REQUIRED_ROLE: wasteOperatorRole
}

function instance(port, env = {}) {
  const url = `http://localhost:${port}`

  return {
    port,
    url,
    logFile: `e2e/.logs/app-${port}.log`,
    env: {
      ...baseEnv,
      ...env,
      PORT: String(port),
      DEFRA_ID_CALLBACK_BASE_URL: url
    }
  }
}

/**
 * One port per instance, consecutive from 3100. Deliberately clear of the
 * compose `frontend` service on 3000 and the Defra ID stub on 3200.
 */
const defaultPort = 3100
const sessionStorePort = 3101
const shortAbsoluteTtlPort = 3102

export const appInstances = {
  /** Default configuration: memory-backed sessions, production-like windows. */
  app: instance(defaultPort),

  /** Redis-backed sessions, so a test can inspect what is actually stored. */
  sessionStore: instance(sessionStorePort, { SESSION_CACHE_ENGINE: 'redis' }),

  /** Absolute session cap shrunk from four hours to seconds. */
  shortAbsoluteTtl: instance(shortAbsoluteTtlPort, {
    SESSION_ABSOLUTE_TTL: String(shortAbsoluteTtlMs)
  })
}

/**
 * The `frontend` service from compose.yml. Not started by Playwright — the
 * containerised journey checks the image as compose runs it, and skips itself
 * when compose is not up.
 */
export const containerisedAppUrl = 'http://localhost:3000'

/** Maps a project's baseURL back to the log file of the instance serving it. */
export function logFileForBaseUrl(baseUrl) {
  const match = Object.values(appInstances).find(
    (candidate) => candidate.url === baseUrl
  )
  return match?.logFile ?? null
}
