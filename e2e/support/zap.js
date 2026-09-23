/**
 * Talk to a running ZAP daemon from the host (Playwright / Node).
 *
 * Hostname "zap" only resolves on the Compose network. From the runner or a
 * laptop the API is http://127.0.0.1:8080 — set ZAP_PROXY_API_URL to that.
 *
 * The Defra ID stub on :3200 is third-party traffic that also flows through
 * the proxy. High alerts on that origin are recorded in the report but must
 * not fail the PR; only the batteries apps (compose frontend :3000 and the
 * Playwright instances on :3100–3102) are gated.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const supportDir = dirname(fileURLToPath(import.meta.url))
export const zapReportsDir = join(supportDir, '..', '..', 'zap-reports')

/** Passive alerts land on a background queue. Asserting before it drains can miss High findings. */
const passiveScanTimeoutMs = 60_000
const passiveScanPollMs = 1_000

/** Ports that belong to this frontend (compose + Playwright instances). */
export const appPorts = new Set([3000, 3100, 3101, 3102])

/** Defra ID stub — proxied, reported, not gated. */
export const stubPort = 3200

export function zapApiUrl() {
  const url = process.env.ZAP_PROXY_API_URL

  if (!url) {
    throw new Error(
      'ZAP_PROXY_API_URL is not set. Start ZAP with the compose overlay and export\n' +
        'ZAP_PROXY_URL and ZAP_PROXY_API_URL as http://127.0.0.1:8080 — see e2e/README.md.'
    )
  }

  return url.replace(/\/$/, '')
}

function portOf(site) {
  try {
    return Number(new URL(site).port)
  } catch {
    return NaN
  }
}

export function isAppSite(site) {
  return appPorts.has(portOf(site))
}

export function isStubSite(site) {
  return portOf(site) === stubPort
}

async function zapFetch(path) {
  const response = await fetch(`${zapApiUrl()}${path}`)

  if (!response.ok) {
    throw new Error(
      `ZAP API ${path} returned ${response.status} ${response.statusText}`
    )
  }

  return response
}

async function zapJson(path) {
  return (await zapFetch(path)).json()
}

export async function listSites() {
  const data = await zapJson('/JSON/core/view/sites/')
  return data.sites ?? []
}

export async function waitForPassiveScan() {
  const deadline = Date.now() + passiveScanTimeoutMs
  let remaining = Number.NaN

  while (Date.now() < deadline) {
    const data = await zapJson('/JSON/pscan/view/recordsToScan/')
    remaining = Number(data.recordsToScan)

    if (!Number.isFinite(remaining)) {
      throw new Error(
        `ZAP recordsToScan was not a number: ${JSON.stringify(data)}`
      )
    }

    if (remaining === 0) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, passiveScanPollMs))
  }

  throw new Error(
    `ZAP passive scan still has ${remaining} record(s) to scan after ${passiveScanTimeoutMs}ms.`
  )
}

export async function alertsSummary(baseUrl) {
  const data = await zapJson(
    `/JSON/alert/view/alertsSummary/?baseurl=${encodeURIComponent(baseUrl)}`
  )
  const summary = data.alertsSummary ?? data

  return {
    High: Number(summary.High ?? 0),
    Medium: Number(summary.Medium ?? 0),
    Low: Number(summary.Low ?? 0),
    Informational: Number(summary.Informational ?? 0)
  }
}

export async function writeReports() {
  await mkdir(zapReportsDir, { recursive: true })

  const html = await zapFetch('/OTHER/core/other/htmlreport/')
  await writeFile(join(zapReportsDir, 'zap-report.html'), await html.text())

  const json = await zapFetch('/OTHER/core/other/jsonreport/')
  await writeFile(join(zapReportsDir, 'zap-report.json'), await json.text())
}
