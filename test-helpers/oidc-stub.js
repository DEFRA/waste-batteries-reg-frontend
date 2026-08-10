/**
 * Vitest setup file. The auth plugin fetches the Defra ID discovery document
 * when the server is created, so every test that calls createServer() needs
 * one. Serve a static document for any OIDC discovery URL and pass all other
 * fetches through untouched.
 *
 * Deliberately does not import the config module — importing it here would
 * freeze config before tests can stub environment variables (e.g. PORT).
 */
export const testOidcConfig = {
  issuer: 'https://test-idp.example',
  authorization_endpoint: 'https://test-idp.example/authorize',
  token_endpoint: 'https://test-idp.example/token',
  jwks_uri: 'https://test-idp.example/keys',
  end_session_endpoint: 'https://test-idp.example/logout'
}

const realFetch = globalThis.fetch

globalThis.fetch = async (url, options) => {
  if (String(url).endsWith('/.well-known/openid-configuration')) {
    return Response.json(testOidcConfig)
  }
  return realFetch(url, options)
}
