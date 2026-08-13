import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

import { logFileForBaseUrl } from './app-instances.js'

/**
 * Reads the log of whichever app instance is serving the current project.
 *
 * Playwright pipes each instance's stdout to its own file (see the webServer
 * commands), which is how a test can assert both the lines the app is supposed
 * to write and the token contents it must never write.
 */

export async function readAppLog(baseUrl) {
  const file = logFileForBaseUrl(baseUrl)

  if (!file) {
    throw new Error(`No app log is captured for ${baseUrl}`)
  }

  try {
    return await readFile(file, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return ''
    throw error
  }
}

/**
 * Logging is asynchronous relative to the response, so a line can arrive just
 * after the assertion would have run. Poll for it.
 */
export async function waitForLogLine(baseUrl, text, { timeout = 10000 } = {}) {
  const deadline = Date.now() + timeout
  let log = ''

  while (Date.now() < deadline) {
    log = await readAppLog(baseUrl)
    if (log.includes(text)) return log
    await delay(200)
  }

  throw new Error(
    `Timed out waiting for "${text}" in the app log for ${baseUrl}.\n` +
      `Last 2000 characters:\n${log.slice(-2000)}`
  )
}
