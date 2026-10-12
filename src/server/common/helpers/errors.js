import { statusCodes } from '../constants/status-codes.js'

// Body copy from the GOV.UK "Page not found" and "There is a problem with
// the service" patterns
const pageNotFoundBody = [
  'If you typed the web address, check it is correct.',
  'If you pasted the web address, check you copied the entire address.'
]
const tryAgainLaterBody = ['Try again later.']

function statusCodeMessage(statusCode) {
  switch (statusCode) {
    case statusCodes.notFound:
      return 'Page not found'
    case statusCodes.forbidden:
      return 'Forbidden'
    case statusCodes.unauthorized:
      return 'Unauthorized'
    case statusCodes.badRequest:
      return 'Bad Request'
    default:
      return 'Something went wrong'
  }
}

export function catchAll(request, h) {
  const { response } = request

  if (!('isBoom' in response)) {
    return h.continue
  }

  const statusCode = response.output.statusCode
  const errorMessage = statusCodeMessage(statusCode)

  if (statusCode >= statusCodes.internalServerError) {
    request.logger.error(response?.stack)
  }

  // Authenticated but missing the required scope
  if (statusCode === statusCodes.forbidden) {
    return h
      .view('unauthorised/no-access', {
        pageTitle: 'You do not have access to this service',
        heading: 'You do not have access to this service'
      })
      .code(statusCode)
  }

  return h
    .view('error/index', {
      pageTitle: errorMessage,
      heading: errorMessage,
      body:
        statusCode === statusCodes.notFound
          ? pageNotFoundBody
          : tryAgainLaterBody
    })
    .code(statusCode)
}
