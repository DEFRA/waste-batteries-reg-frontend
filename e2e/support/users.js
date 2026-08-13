import { wasteOperatorRole } from './app-instances.js'

/**
 * Test users registered at the Defra ID stub.
 *
 * Each has a fixed userId so re-running the suite overwrites the registration
 * instead of piling up duplicates, and a distinct email so a spec can pick its
 * own row out of the stub's user table — and, for the Redis journey, pick its
 * own session out of the shared store.
 *
 * `roleStatus: '3'` is the only status the app treats as an active role; the
 * profile builder drops everything else, so a user whose only role is pending
 * ends up with the baseline `user` scope and nothing more.
 */

const activeRole = '3'
const pendingRole = '2'

function user({ userId, email, firstName, lastName, relationships }) {
  return {
    userId,
    email,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    relationships
  }
}

function organisation(organisationName, roleStatus = activeRole) {
  return { organisationName, roleName: wasteOperatorRole, roleStatus }
}

/** The everyday user: one organisation, one active role. */
export const operatorUser = user({
  userId: 'e2e00001-0000-4000-8000-000000000001',
  email: 'e2e-operator@example.com',
  firstName: 'Olivia',
  lastName: 'Operator',
  relationships: [organisation('Acme Waste Ltd')]
})

/** Signed in, but their only role is still pending — no access to the service. */
export const pendingRoleUser = user({
  userId: 'e2e00002-0000-4000-8000-000000000002',
  email: 'e2e-pending@example.com',
  firstName: 'Pat',
  lastName: 'Pending',
  relationships: [organisation('Halfway Waste Ltd', pendingRole)]
})

/** Two organisations, so the stub shows its organisation picker. */
export const multiOrganisationUser = user({
  userId: 'e2e00003-0000-4000-8000-000000000003',
  email: 'e2e-multi-org@example.com',
  firstName: 'Morgan',
  lastName: 'Multi',
  relationships: [
    organisation('Alpha Waste Ltd'),
    organisation('Beta Waste Ltd')
  ]
})

/** Owns the session the Redis journey inspects. */
export const sessionStoreUser = user({
  userId: 'e2e00004-0000-4000-8000-000000000004',
  email: 'e2e-session-store@example.com',
  firstName: 'Sam',
  lastName: 'Store',
  relationships: [organisation('Cache Waste Ltd')]
})

/** Signs in against the containerised app from compose.yml. */
export const containerisedUser = user({
  userId: 'e2e00007-0000-4000-8000-000000000007',
  email: 'e2e-container@example.com',
  firstName: 'Charlie',
  lastName: 'Container',
  relationships: [organisation('Docker Waste Ltd')]
})

export const allUsers = [
  operatorUser,
  pendingRoleUser,
  multiOrganisationUser,
  sessionStoreUser,
  containerisedUser
]
