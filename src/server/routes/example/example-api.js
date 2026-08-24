import { config } from '#/config/config.js'

export class BackendError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.name = 'BackendError'
    this.statusCode = statusCode
  }
}

function backendUrl(path) {
  return new URL(path, config.get('wasteBatteriesRegBackendUrl'))
}

export async function getExamples(userId) {
  const url = backendUrl('/example')
  url.searchParams.set('userId', userId)

  const response = await fetch(url, {
    headers: {
      accept: 'application/json'
    }
  })

  if (!response.ok) {
    throw new BackendError(
      'Backend failed to fetch example text',
      response.status
    )
  }

  return response.json()
}

export async function saveExample({ exampleText, userId }) {
  const response = await fetch(backendUrl('/example'), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ exampleText, userId })
  })

  if (!response.ok) {
    throw new BackendError(
      'Backend failed to save example text',
      response.status
    )
  }

  return response.json()
}
