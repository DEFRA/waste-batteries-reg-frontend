/**
 * onPreResponse ext: cache-control no-store on authenticated responses, so
 * the browser back button cannot show a signed-in page after sign-out.
 * Public routes (/health, static assets) are auth: false, so never match.
 * Registered after catchAll so error pages get the header too.
 */
export function noStore(request, h) {
  if (!request.auth?.isAuthenticated) {
    return h.continue
  }

  const { response } = request
  if (response.isBoom) {
    response.output.headers['cache-control'] = 'no-store'
  } else {
    response.header('cache-control', 'no-store')
  }

  return h.continue
}
