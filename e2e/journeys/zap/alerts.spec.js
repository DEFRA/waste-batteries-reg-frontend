import { test, expect } from '@playwright/test'

import {
  alertsSummary,
  isAppSite,
  listSites,
  waitForPassiveScan,
  writeReports
} from '../../support/zap.js'

/**
 * Passive ZAP gate, run after the journeys have pushed traffic through the
 * daemon. Fail the PR on High alerts against our apps; leave Medium/Low in
 * the HTML/JSON report. The spec waits until the passive scan queue is empty
 * first, so a High alert still being raised cannot slip through. An empty
 * scan (no app origin seen) is also a failure — Chromium otherwise bypasses
 * the proxy for localhost, and every batteries origin is localhost.
 *
 * The Defra ID stub on :3200 is excluded from the High=0 assertion.
 */
test.describe('ZAP alerts', { tag: '@zap' }, () => {
  test('exports reports and finds no High alerts on the batteries apps', async () => {
    // Default test timeout is 60s; the passive-scan wait may use all of that.
    test.setTimeout(120_000)
    await waitForPassiveScan()
    await writeReports()

    const sites = await listSites()
    const appSites = sites.filter(isAppSite)

    expect(
      appSites,
      'ZAP saw no traffic to the batteries apps (ports 3000, 3100–3102). ' +
        'Chromium skips the proxy for localhost unless launched with ' +
        '--proxy-bypass-list=<-loopback>. Sites recorded: ' +
        `${sites.join(', ') || '(none)'}`
    ).not.toHaveLength(0)

    for (const site of appSites) {
      const summary = await alertsSummary(site)
      expect(
        summary.High,
        `${site} has ${summary.High} High alert(s). Medium=${summary.Medium} ` +
          `Low=${summary.Low} Informational=${summary.Informational}. ` +
          'See zap-reports/zap-report.html — fix the app rather than weakening this gate.'
      ).toBe(0)
    }
  })
})
