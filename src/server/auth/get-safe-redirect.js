// Only allow relative single-slash paths as post-sign-in redirects.
// "//evil.example" and "/\evil.example" are both absolute to a browser.
export function getSafeRedirect(value) {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}
