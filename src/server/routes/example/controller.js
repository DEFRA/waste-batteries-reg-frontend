import { statusCodes } from '#/server/common/constants/status-codes.js'
import { getExamples, saveExample } from './example-api.js'

const pageTitle = 'Example'

function viewContext(request, values = {}) {
  return {
    pageTitle,
    heading: pageTitle,
    breadcrumbs: [{ text: 'Home', href: '/' }, { text: pageTitle }],
    crumb: request.plugins.crumb,
    exampleText: '',
    ...values
  }
}

export const exampleGetController = {
  async handler(request, h) {
    let exampleText = ''
    let loadErrorMessage

    try {
      const examples = await getExamples(request.auth.credentials.accessToken)
      exampleText = examples.at(0)?.exampleText ?? ''
    } catch (error) {
      request.logger.error(
        error,
        'Could not fetch example text from the backend'
      )
      loadErrorMessage = 'There was a problem loading saved example text'
    }

    return h.view(
      'example/index',
      viewContext(request, {
        exampleText,
        loadErrorMessage,
        successMessage: request.yar.flash('exampleSaved')?.at(0)
      })
    )
  }
}

export const examplePostController = {
  async handler(request, h) {
    try {
      await saveExample({
        exampleText: request.payload.exampleText,
        accessToken: request.auth.credentials.accessToken
      })
    } catch (error) {
      request.logger.error(error, 'Could not save example text to the backend')

      return h
        .view(
          'example/index',
          viewContext(request, {
            exampleText: request.payload.exampleText,
            errorMessage: 'There was a problem saving the example text'
          })
        )
        .code(statusCodes.internalServerError)
    }

    request.yar.flash('exampleSaved', 'Example text saved')

    return h.redirect('/example')
  }
}

export function exampleFailAction(request, h, error) {
  request.logger.info(error, 'Example text validation failed')

  return h
    .view(
      'example/index',
      viewContext(request, {
        exampleText: request.payload.exampleText,
        errorMessage: 'Enter example text'
      })
    )
    .code(statusCodes.badRequest)
    .takeover()
}
