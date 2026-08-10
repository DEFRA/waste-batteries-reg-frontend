import {
  buildUserProfile,
  parseRelationship,
  parseRole
} from './user-profile.js'

describe('#parseRelationship', () => {
  test('Should parse a six-field relationship', () => {
    expect(parseRelationship('rel-1:org-1:Acme Ltd:2:Employee:1')).toEqual({
      relationshipId: 'rel-1',
      organisationId: 'org-1',
      organisationName: 'Acme Ltd',
      organisationLoa: 2,
      relationship: 'Employee',
      relationshipLoa: 1
    })
  })

  test('Should keep colons inside the organisation name', () => {
    expect(
      parseRelationship('rel-1:org-1:Recycling: North :Ltd:3:Agent:2')
    ).toEqual({
      relationshipId: 'rel-1',
      organisationId: 'org-1',
      organisationName: 'Recycling: North :Ltd',
      organisationLoa: 3,
      relationship: 'Agent',
      relationshipLoa: 2
    })
  })

  test('Should return null for malformed values', () => {
    expect(parseRelationship('rel-1:org-1:too-short')).toBeNull()
    expect(parseRelationship(undefined)).toBeNull()
    expect(parseRelationship('')).toBeNull()
  })
})

describe('#parseRole', () => {
  test('Should parse a role and mark status 3 as active', () => {
    expect(parseRole('rel-1:Certifier:3')).toEqual({
      relationshipId: 'rel-1',
      roleName: 'Certifier',
      status: 3,
      isActive: true
    })
  })

  test.each([1, 2, 4, 5, 6, 7])(
    'Should mark status %i as not active',
    (status) => {
      expect(parseRole(`rel-1:Certifier:${status}`).isActive).toBe(false)
    }
  )

  test('Should keep colons inside the role name', () => {
    expect(parseRole('rel-1:Waste: Admin:3')).toMatchObject({
      roleName: 'Waste: Admin',
      isActive: true
    })
  })

  test('Should return null for malformed values', () => {
    expect(parseRole('rel-1:no-status')).toBeNull()
    expect(parseRole(undefined)).toBeNull()
  })
})

describe('#buildUserProfile', () => {
  const claims = {
    sub: 'user-123',
    contactId: 'contact-456',
    correlationId: 'corr-789',
    sessionId: 'idp-session-1',
    email: 'jo.bloggs@example.com',
    firstName: 'Jo',
    lastName: 'Bloggs',
    uniqueReference: 'REF-001',
    loa: 1,
    aal: '1',
    enrolmentCount: 2,
    enrolmentRequestCount: 0,
    currentRelationshipId: 'rel-1',
    relationships: [
      'rel-1:org-1:Acme Ltd:2:Employee:1',
      'rel-2:org-2:Beta Ltd:2:Employee:1'
    ],
    roles: [
      'rel-1:Certifier:3', // current relationship, approved
      'rel-1:Submitter:2', // current relationship, but only pending
      'rel-2:Admin:3' // approved, but a different relationship
    ]
  }

  test('Should only grant scopes for approved roles at the current relationship', () => {
    expect(buildUserProfile(claims, 'id-token').scope).toEqual([
      'user',
      'Certifier'
    ])
  })

  test('Should resolve the current organisation', () => {
    expect(buildUserProfile(claims, 'id-token')).toMatchObject({
      id: 'user-123',
      displayName: 'Jo Bloggs',
      aal: 1,
      currentRelationshipId: 'rel-1',
      organisationId: 'org-1',
      organisationName: 'Acme Ltd',
      idToken: 'id-token'
    })
  })

  test('Should tolerate absent relationships and roles claims', () => {
    expect(buildUserProfile({ sub: 'user-123' }, undefined)).toMatchObject({
      relationships: [],
      roles: [],
      scope: ['user'],
      currentRelationshipId: null,
      organisationId: null,
      organisationName: null,
      enrolmentCount: 0,
      enrolmentRequestCount: 0
    })
  })
})
