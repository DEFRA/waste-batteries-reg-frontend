import { test, expect } from '@playwright/test'

import {
  signIn,
  chooseOrganisation,
  expectOrganisationPicker,
  expectSignedInAs
} from '../../support/journeys.js'
import { redirectTarget } from '../../support/http.js'
import { multiOrganisationUser } from '../../support/users.js'

/**
 * Manual checklist phase 9 — switching organisation.
 *
 * A user with several relationships picks one at sign-in, and the profile the
 * app builds only carries the roles for that one. Switching therefore has to go
 * back through Defra ID rather than being a local toggle, and it has to ask for
 * the picker explicitly — otherwise the identity provider silently reissues the
 * organisation the user already had.
 */
const [firstOrganisation, secondOrganisation] =
  multiOrganisationUser.relationships.map(
    (relationship) => relationship.organisationName
  )

test.describe('Organisation switching', { tag: '@auth' }, () => {
  test('offers a picker at sign-in and shows the chosen organisation', async ({
    page
  }) => {
    await page.goto('/auth/sign-in')
    await page
      .getByRole('row', { name: multiOrganisationUser.email })
      .getByRole('link', { name: 'Log in' })
      .click()

    await expectOrganisationPicker(page)
    await chooseOrganisation(page, firstOrganisation)

    await expectSignedInAs(page, multiOrganisationUser, {
      organisation: firstOrganisation
    })
  })

  test('asks Defra ID to re-show the picker when switching', async ({
    page
  }) => {
    await signIn(page, multiOrganisationUser, {
      organisation: firstOrganisation
    })

    const response = await page.request.get('/auth/organisation', {
      maxRedirects: 0
    })

    expect(response.status()).toBe(302)
    expect(redirectTarget(response).searchParams.get('forceReselection')).toBe(
      'true'
    )
  })

  test('updates the header to the newly chosen organisation', async ({
    page
  }) => {
    await signIn(page, multiOrganisationUser, {
      organisation: firstOrganisation
    })
    await page.goto('/')
    await expectSignedInAs(page, multiOrganisationUser, {
      organisation: firstOrganisation
    })

    await page.goto('/auth/organisation')
    await chooseOrganisation(page, secondOrganisation)

    await expectSignedInAs(page, multiOrganisationUser, {
      organisation: secondOrganisation
    })
  })
})
