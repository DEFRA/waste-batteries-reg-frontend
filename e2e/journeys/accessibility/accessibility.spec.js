import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { signIn } from '../../support/journeys.js'
import { operatorUser, pendingRoleUser } from '../../support/users.js'

/** Each page: how to reach it, and who has to be signed in to see it. */
const pages = [
  { name: 'Home (signed out)', path: '/' },
  { name: 'About (signed out)', path: '/about' },
  { name: 'Not found', path: '/no-such-page' },
  {
    name: 'Could not sign you in',
    path: '/auth/sign-in-oidc?error=access_denied'
  },
  { name: 'Home (signed in)', path: '/', user: operatorUser },
  { name: 'About (signed in)', path: '/about', user: operatorUser },
  { name: 'Example', path: '/example', user: operatorUser },
  {
    name: 'Example (validation error)',
    path: '/example',
    user: operatorUser,
    hasErrors: true,
    async act(page) {
      await page.getByLabel('Example Text').fill('')
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByText('There is a problem')).toBeVisible()
    }
  },
  {
    name: 'No access',
    path: '/e2e/role-protected',
    user: pendingRoleUser
  }
]

test.describe('Accessibility', { tag: '@a11y' }, () => {
  for (const { name, path, user, act, hasErrors } of pages) {
    const open = async (page) => {
      if (user) {
        await signIn(page, user)
      }
      await page.goto(path)
      await act?.(page)
    }

    test(`${name} meets WCAG 2.2 AA`, async ({ page }) => {
      await open(page)

      const { violations } = await new AxeBuilder({ page })
        /**
         * Axe's tags are not cumulative, so AA means listing every level up to it.
         * best-practice adds axe's non-WCAG rules, such as landmarks.
         * /e2e/protected is bare harness HTML, so is deliberately not scanned;
         * /e2e/role-protected is, because a pending user gets the real no-access page.
         */
        .withTags([
          'wcag2a',
          'wcag2aa',
          'wcag21a',
          'wcag21aa',
          'wcag22a',
          'wcag22aa',
          'best-practice'
        ])
        .analyze()

      expect(
        violations.map(({ id, impact, help, nodes }) => ({
          id,
          impact,
          help,
          targets: nodes.map((node) => node.target.join(' '))
        }))
      ).toEqual([])
    })

    test(`${name} has a title that matches its heading`, async ({ page }) => {
      await open(page)

      // GOV.UK pattern: "<h1> | <service>", prefixed "Error: " when the page
      // shows a validation error, so screen readers announce it first
      const heading = (await page.locator('h1').innerText()).trim()
      const [titleStart] = (await page.title()).split(' | ')

      expect(titleStart).toBe(`${hasErrors ? 'Error: ' : ''}${heading}`)
    })
  }
})
