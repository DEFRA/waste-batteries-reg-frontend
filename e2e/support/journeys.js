import { expect } from '@playwright/test'

import { stubOrigin } from './stub.js'

/**
 * The user-facing steps of the Defra ID journeys, written the way the manual
 * checklist describes them: click Sign in, pick your user at the identity
 * provider, pick your organisation, land back in the service.
 */

/** True once the browser has come back from the identity provider. */
function isBackInTheService(url) {
  return url.origin !== stubOrigin
}

export async function expectAtIdentityProvider(page) {
  await expect(page).toHaveURL(new RegExp(`^${stubOrigin}/`))
  await expect(page.getByText('Registered users')).toBeVisible()
}

export async function chooseUserAtIdentityProvider(page, user) {
  await page
    .getByRole('row', { name: user.email })
    .getByRole('link', { name: 'Log in' })
    .click()
}

export async function expectOrganisationPicker(page) {
  await expect(page.getByText('Select your organisation')).toBeVisible()
}

export async function chooseOrganisation(page, organisationName) {
  await expectOrganisationPicker(page)
  await page.getByLabel(organisationName).check()
  await page.getByRole('button', { name: 'Continue' }).click()
}

/**
 * The whole sign-in journey. `startAt` lets a test enter it the way a real user
 * would — from the header link, or from a deep link that carries a redirect.
 */
export async function signIn(
  page,
  user,
  { startAt = '/auth/sign-in', organisation } = {}
) {
  await page.goto(startAt)
  await expectAtIdentityProvider(page)
  await chooseUserAtIdentityProvider(page, user)

  if (user.relationships.length > 1) {
    await chooseOrganisation(
      page,
      organisation ?? user.relationships[0].organisationName
    )
  }

  await page.waitForURL(isBackInTheService)
}

/** Signs in by clicking the header link, as a user arriving on the site would. */
export async function signInFromHeader(page, user, options = {}) {
  await page.goto('/')
  await page.getByRole('link', { name: 'Sign in' }).click()
  await expectAtIdentityProvider(page)
  await chooseUserAtIdentityProvider(page, user)

  if (user.relationships.length > 1) {
    await chooseOrganisation(
      page,
      options.organisation ?? user.relationships[0].organisationName
    )
  }

  await page.waitForURL(isBackInTheService)
}

export async function signOut(page) {
  await page.getByRole('link', { name: 'Sign out' }).click()
  await page.waitForURL(isBackInTheService)
}

export async function expectSignedInAs(page, user, { organisation } = {}) {
  const banner = page.getByTestId('app-signed-in-user')

  await expect(banner).toContainText(user.displayName)
  await expect(banner).toContainText(
    organisation ?? user.relationships[0].organisationName
  )
  await expect(page.getByRole('link', { name: 'Sign out' })).toBeVisible()
}

/**
 * Asserts the app has stopped accepting the session and is sending the user
 * back to sign in.
 *
 * Deliberately checked as a raw 302 rather than by following it: Defra ID keeps
 * its own sign-in session, so a browser can sail straight back through and land
 * on the page again, hiding the fact that the app's session had gone.
 */
export async function expectRedirectToSignIn(page, path) {
  const response = await page.request.get(path, { maxRedirects: 0 })

  expect(response.status()).toBe(302)

  const location = response.headers().location
  expect(location).toContain('/auth/sign-in')
  expect(location).toContain(`redirect=${encodeURIComponent(path)}`)

  return response
}

export async function expectSignedOut(page) {
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByTestId('app-signed-in-user')).toHaveCount(0)
}
