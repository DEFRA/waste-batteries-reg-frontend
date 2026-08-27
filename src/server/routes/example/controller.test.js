import { vi } from 'vitest'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

function extractCrumb(html) {
  return html.match(/name="crumb" value="([^"]+)"/)?.[1]
}

function cookieHeader(setCookie) {
  return setCookie.map((cookie) => cookie.split(';')[0]).join('; ')
}

describe('#exampleController', () => {
  const originalFetch = globalThis.fetch
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    globalThis.fetch = originalFetch
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    globalThis.fetch = originalFetch
  })

  test('Should redirect signed-out users to sign in', async () => {
    const { headers, statusCode } = await server.inject({
      method: 'GET',
      url: '/example'
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/auth/sign-in?redirect=%2Fexample')
  })

  test('Should render the example form for signed-in users', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json([
        {
          id: 'example-123',
          exampleText: 'Saved text',
          userId: 'user-123',
          createdAt: '2026-08-22T14:00:00.000Z'
        }
      ])
    )
    globalThis.fetch = fetchMock

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/example',
      auth: {
        strategy: 'session',
        credentials: {
          id: 'user-123',
          sessionId: 'sid',
          scope: ['user'],
          accessToken: 'access-token'
        }
      }
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Example Text')
    expect(result).toContain('Saved text')
    expect(result).toContain('name="crumb"')
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('/example', 'http://localhost:3001'),
      {
        headers: {
          accept: 'application/json',
          authorization: 'Bearer access-token'
        }
      }
    )
  })

  test('Should save example text with the authenticated user id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(
        Response.json({
          id: 'example-123',
          exampleText: 'Hello backend',
          userId: 'user-123',
          createdAt: '2026-08-22T14:00:00.000Z'
        })
      )
    globalThis.fetch = fetchMock

    const getResponse = await server.inject({
      method: 'GET',
      url: '/example',
      auth: {
        strategy: 'session',
        credentials: {
          id: 'user-123',
          sessionId: 'sid',
          scope: ['user'],
          accessToken: 'access-token'
        }
      }
    })

    const crumb = extractCrumb(getResponse.result)

    const { headers, statusCode } = await server.inject({
      method: 'POST',
      url: '/example',
      headers: {
        cookie: cookieHeader(getResponse.headers['set-cookie'])
      },
      payload: {
        crumb,
        exampleText: 'Hello backend'
      },
      auth: {
        strategy: 'session',
        credentials: {
          id: 'user-123',
          sessionId: 'sid',
          scope: ['user'],
          accessToken: 'access-token'
        }
      }
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/example')
    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL('/example', 'http://localhost:3001'),
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: 'Bearer access-token'
        },
        body: JSON.stringify({
          exampleText: 'Hello backend'
        })
      }
    )
  })
})
