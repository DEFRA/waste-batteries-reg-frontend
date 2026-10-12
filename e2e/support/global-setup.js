import { execSync } from 'node:child_process'

import { isStubRunning, registerUsers } from './stub.js'
import { allUsers } from './users.js'

/**
 * Registers every test user at the Defra ID stub before the suite runs, and
 * fails with a usable message when the stub is not up — an unreachable identity
 * provider would otherwise surface as every journey timing out at a blank page.
 *
 * Registration is keyed on userId, so this also resets any user a previous run
 * left expired.
 */
export default async function globalSetup() {
  // The test servers run with NODE_ENV=test, which serves the built assets in
  // .public rather than Vite's dev middleware — so build them, or every page
  // renders unstyled
  execSync('npm run build:frontend', { stdio: 'inherit' })

  if (!(await isStubRunning())) {
    throw new Error(
      'The Defra ID stub is not reachable on http://localhost:3200.\n' +
        'Start it first: docker compose up -d cdp-defra-id-stub'
    )
  }

  await registerUsers(allUsers)
}
