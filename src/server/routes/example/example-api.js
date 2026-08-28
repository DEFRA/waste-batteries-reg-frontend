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

function backendHeaders(accessToken, extraHeaders = {}) {
  return {
    accept: 'application/json',
    authorization: `Bearer ${accessToken}`,
    ...extraHeaders
  }
}

export async function getExamples(accessToken) {
  const url = backendUrl('/example')

  const response = await fetch(url, {
    headers: backendHeaders(accessToken)
  })

  if (!response.ok) {
    throw new BackendError(
      'Backend failed to fetch example text',
      response.status
    )
  }

  return response.json()
}

export async function saveExample({ exampleText, accessToken }) {
  const response = await fetch(backendUrl('/example'), {
    method: 'POST',
    headers: backendHeaders(accessToken, {
      'content-type': 'application/json'
    }),
    body: JSON.stringify({ exampleText })
  })

  if (!response.ok) {
    throw new BackendError(
      'Backend failed to save example text',
      response.status
    )
  }

  return response.json()
}
