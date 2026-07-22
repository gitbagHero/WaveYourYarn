import { describe, expect, it, vi } from 'vitest'
import { NetworkTransport, type PinnedRequestExecutor } from './NetworkTransport'

const publicLookup = async (): Promise<Array<{ address: string; family: number }>> => [
  { address: '93.184.216.34', family: 4 }
]

describe('NetworkTransport', () => {
  it('validates DNS and returns a non-redirect response', async () => {
    const requestMock = vi.fn<PinnedRequestExecutor>(async () =>
      Promise.resolve(new Response('ok', { status: 200 }))
    )
    const transport = new NetworkTransport(requestMock, publicLookup)

    const response = await transport.request(new URL('https://api.example.test/v1/chat'), {
      method: 'POST',
      body: '{}',
      timeoutMs: 1_000
    })

    expect(await response.text()).toBe('ok')
    expect(requestMock).toHaveBeenCalledOnce()
    expect(requestMock.mock.calls[0]?.[2]).toEqual({ address: '93.184.216.34', family: 4 })
  })

  it('blocks a public hostname that resolves to a private address', async () => {
    const requestMock = vi.fn(async () => new Response('should not run'))
    const transport = new NetworkTransport(requestMock, async () => [
      { address: '192.168.1.2', family: 4 }
    ])

    await expect(
      transport.request(new URL('https://api.example.test/v1/chat'), {
        method: 'POST',
        timeoutMs: 1_000
      })
    ).rejects.toMatchObject({ code: 'ENDPOINT_BLOCKED' })
    expect(requestMock).not.toHaveBeenCalled()
  })

  it('follows only validated same-origin 307/308 redirects', async () => {
    const requestMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 307, headers: { Location: '/v1/chat-final' } })
      )
      .mockResolvedValueOnce(new Response('done', { status: 200 }))
    const transport = new NetworkTransport(requestMock, publicLookup)

    const response = await transport.request(new URL('https://api.example.test/v1/chat'), {
      method: 'POST',
      timeoutMs: 1_000
    })
    expect(await response.text()).toBe('done')
    expect(requestMock).toHaveBeenCalledTimes(2)
    expect(requestMock.mock.calls[1]?.[0].toString()).toBe('https://api.example.test/v1/chat-final')
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
    const abortingRequest = async (
      _url: URL,
      options: { signal: AbortSignal }
    ): Promise<Response> =>
      new Promise((_resolve, reject) => {
        if (options.signal.aborted) {
          reject(new DOMException('aborted', 'AbortError'))
          return
        }
        options.signal.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true }
        )
      })
    const transport = new NetworkTransport(abortingRequest, publicLookup)

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
