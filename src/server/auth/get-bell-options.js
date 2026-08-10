import { config } from '#/config/config.js'
import { verifyToken } from './verify-token.js'
import { buildUserProfile } from './user-profile.js'
import { getSafeRedirect } from './get-safe-redirect.js'

export function getBellOptions(oidcConfig) {
  const clientId = config.get('defraId.clientId')

  return {
    provider: {
      name: 'defra-id',
      protocol: 'oauth2',
      useParamsAuth: true,
      auth: oidcConfig.authorization_endpoint,
      token: oidcConfig.token_endpoint,
      // Config-driven: real Defra ID requires the client_id as a third scope
      // to issue an access token (B2C convention); the CDP stub rejects it.
      // See the defraId.scopes doc in config.js
      scope: config.get('defraId.scopes'),
      profile: async function (credentials, params) {
        // Verify signature + iss/aud/exp before trusting a single claim
        const claims = await verifyToken(credentials.token)
        credentials.profile = buildUserProfile(claims, params.id_token)
      }
    },
    clientId,
    clientSecret: config.get('defraId.clientSecret'),
    password: config.get('session.cookie.password'),
    isSecure: config.get('session.cookie.secure'),
    // Lax — bell's transaction cookie must survive the redirect back from the IdP
    isSameSite: 'Lax',
    location: function (request) {
      if (request.query.redirect) {
        // yar-backed so it survives the round trip to the IdP
        request.yar.flash('redirect', getSafeRedirect(request.query.redirect))
      }
      return `${config.get('defraId.callbackBaseUrl')}/auth/sign-in-oidc`
    },
    // No response_mode param: the code flow returns via the query string by
    // default (which is what bell's GET callback needs), and the CDP stub
    // rejects an explicit response_mode as an unsupported parameter
    providerParams: function (request) {
      const params = {
        serviceId: config.get('defraId.serviceId')
      }
      const policy = config.get('defraId.policy')
      if (policy) params.p = policy
      if (request.path === '/auth/organisation') params.forceReselection = true
      return params
    }
  }
}
