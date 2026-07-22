import { describe, expect, it, vi } from 'vitest'
import { NetworkTransport } from './NetworkTransport'

const publicLookup = async (): Promise<Array<{ address: string; family: number }>> => [
  { address: '93.184.216.34', family: 4 }
]

describe('NetworkTransport', () => {
  it('validates DNS and returns a non-redirect response', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }))
    const transport = new NetworkTransport(fetchMock, publicLookup)

    const response = await transport.request(new URL('https://api.example.test/v1/chat'), {
      method: 'POST',
      body: '{}',
      timeoutMs: 1_000
    })

    expect(await response.text()).toBe('ok')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('blocks a public hostname that resolves to a private address', async () => {
    const fetchMock = vi.fn(async () => new Response('should not run'))
    const transport = new NetworkTransport(fetchMock, async () => [
      { address: '192.168.1.2', family: 4 }
    ])

    await expect(
      transport.request(new URL('https://api.example.test/v1/chat'), {
        method: 'POST',
        timeoutMs: 1_000
      })
    ).rejects.toMatchObject({ code: 'ENDPOINT_BLOCKED' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('follows only validated same-origin 307/308 redirects', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 307, headers: { Location: '/v1/chat-final' } })
      )
      .mockResolvedValueOnce(new Response('done', { status: 200 }))
    const transport = new NetworkTransport(fetchMock, publicLookup)

    const response = await transport.request(new URL('https://api.example.test/v1/chat'), {
      method: 'POST',
      timeoutMs: 1_000
    })
    expect(await response.text()).toBe('done')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0].toString()).toBe('https://api.example.test/v1/chat-final')
  })

  it('blocks cross-origin and method-changing redirects', async () => {
    const crossOrigin = new NetworkTransport(
      async () =>
        new Response(null, {
          status: 307,
          headers: { Location: 'https://other.example.test/v1/chat' }
        }),
      publicLookup
    )
    await expect(
      crossOrigin.request(new URL('https://api.example.test/v1/chat'), {
        method: 'POST',
        timeoutMs: 1_000
      })
    ).rejects.toMatchObject({ code: 'REDIRECT_BLOCKED' })

    const methodChanging = new NetworkTransport(
      async () => new Response(null, { status: 302, headers: { Location: '/other' } }),
      publicLookup
    )
    await expect(
      methodChanging.request(new URL('https://api.example.test/v1/chat'), {
        method: 'POST',
        timeoutMs: 1_000
      })
    ).rejects.toMatchObject({ code: 'REDIRECT_BLOCKED' })
  })

  it('distinguishes timeout from caller cancellation', async () => {
    const abortingFetch = async (
      _url: Parameters<typeof fetch>[0],
      init?: RequestInit
    ): Promise<Response> =>
      new Promise((_resolve, reject) => {
        if (init?.signal?.aborted) {
          reject(new DOMException('aborted', 'AbortError'))
          return
        }
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true }
        )
      })
    const transport = new NetworkTransport(abortingFetch, publicLookup)

    await expect(
      transport.request(new URL('https://api.example.test/v1/chat'), {
        method: 'POST',
        timeoutMs: 5
      })
    ).rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' })

    const controller = new AbortController()
    const request = transport.request(new URL('https://api.example.test/v1/chat'), {
      method: 'POST',
      timeoutMs: 1_000,
      signal: controller.signal
    })
    controller.abort()
    await expect(request).rejects.toMatchObject({ code: 'NETWORK_CANCELLED' })
  })
})
