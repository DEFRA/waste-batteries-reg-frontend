// Fixed fields from each end; the middle remainder is the organisation name,
// which can itself contain colons
export function parseRelationship(value) {
  const parts = String(value).split(':')
  if (parts.length < 6) return null

  const [relationshipId, organisationId] = parts
  const [organisationLoa, relationship, relationshipLoa] = parts.slice(-3)

  return {
    relationshipId,
    organisationId,
    organisationName: parts.slice(2, -3).join(':'),
    organisationLoa: Number(organisationLoa),
    relationship, // Citizen | Employee | Agent
    relationshipLoa: Number(relationshipLoa)
  }
}

export function parseRole(value) {
  const parts = String(value).split(':')
  if (parts.length < 3) return null

  const status = Number(parts.at(-1))
  return {
    relationshipId: parts[0],
    roleName: parts.slice(1, -1).join(':'),
    status,
    isActive: status === 3
  }
}

export function buildUserProfile(claims, idToken) {
  const relationships = (claims.relationships ?? [])
    .map(parseRelationship)
    .filter(Boolean)
  const roles = (claims.roles ?? []).map(parseRole).filter(Boolean)
  const current =
    relationships.find(
      (relationship) =>
        relationship.relationshipId === claims.currentRelationshipId
    ) ?? null

  // Only roles at the CURRENT relationship, only status 3 (complete/approved)
  const currentRoles = roles
    .filter(
      (role) =>
        role.relationshipId === claims.currentRelationshipId && role.isActive
    )
    .map((role) => role.roleName)

  return {
    id: claims.sub,
    contactId: claims.contactId,
    correlationId: claims.correlationId,
    tokenSessionId: claims.sessionId,
    email: claims.email,
    firstName: claims.firstName,
    lastName: claims.lastName,
    displayName: [claims.firstName, claims.lastName].filter(Boolean).join(' '),
    uniqueReference: claims.uniqueReference,
    loa: claims.loa,
    aal: Number(claims.aal),
    enrolmentCount: claims.enrolmentCount ?? 0,
    enrolmentRequestCount: claims.enrolmentRequestCount ?? 0,
    currentRelationshipId: claims.currentRelationshipId ?? null,
    organisationId: current?.organisationId ?? null,
    organisationName: current?.organisationName ?? null,
    relationships,
    roles,
    idToken, // kept only for id_token_hint at sign-out
    // hapi route authorisation reads credentials.scope
    scope: ['user', ...currentRoles]
  }
}
