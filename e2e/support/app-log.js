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
    if (error.code === 'ENOENT') {
      return ''
    }
    throw error
  }
}

/** How long to keep re-reading the log before giving up on a line. */
const defaultTimeoutMs = 10000

/** How long to wait between re-reads while polling. */
const pollIntervalMs = 200

/** How much of the log to quote when the wait times out. */
const logTailChars = 2000

/**
 * Logging is asynchronous relative to the response, so a line can arrive just
 * after the assertion would have run. Poll for it.
 */
export async function waitForLogLine(
  baseUrl,
  text,
  { timeout = defaultTimeoutMs } = {}
) {
  const deadline = Date.now() + timeout
  let log = ''

  while (Date.now() < deadline) {
    log = await readAppLog(baseUrl)
    if (log.includes(text)) {
      return log
    }
    await delay(pollIntervalMs)
  }

  throw new Error(
    `Timed out waiting for "${text}" in the app log for ${baseUrl}.\n` +
      `Last ${logTailChars} characters:\n${log.slice(-logTailChars)}`
  )
}
