/**
 * Cross-platform launcher for the e2e app instances.
 *
 * Playwright used to start the server with a Unix shell pipeline
 * (`mkdir -p ... && node ... > logfile 2>&1`), which fails on Windows.
 * This script creates the log directory and redirects stdout/stderr at
 * the file-descriptor level so pino still lands in the log file.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const logFile = process.env.E2E_LOG_FILE

if (!logFile) {
  throw new Error('E2E_LOG_FILE is required')
}

fs.mkdirSync(path.dirname(logFile), { recursive: true })

const logFd = fs.openSync(logFile, 'w')
const script = fileURLToPath(new URL('./test-server.js', import.meta.url))

const child = spawn(process.execPath, [script], {
  stdio: ['ignore', logFd, logFd],
  env: process.env
})

const shutDown = (code) => {
  try {
    fs.closeSync(logFd)
  } catch {
    // already closed when Playwright kills the process tree
  }
  process.exit(code ?? 1)
}

child.on('exit', shutDown)
child.on('error', (error) => {
  console.error(error)
  shutDown(1)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal)
    }
  })
}
