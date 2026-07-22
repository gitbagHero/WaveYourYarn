import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import {
  assertResolvedAddressAllowed,
  ExternalUrlPolicyError,
  validateExternalRequestUrl
} from './externalUrlPolicy'

const DEFAULT_MAX_REDIRECTS = 2

export type NetworkTransportErrorCode =
  | 'ENDPOINT_BLOCKED'
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_CANCELLED'
  | 'NETWORK_FAILED'
  | 'REDIRECT_BLOCKED'

export class NetworkTransportError extends Error {
  constructor(
    readonly code: NetworkTransportErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'NetworkTransportError'
  }
}

export interface NetworkRequestOptions {
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  timeoutMs: number
  signal?: AbortSignal
  maxRedirects?: number
}

export interface NetworkTransportLike {
  request(url: URL, options: NetworkRequestOptions): Promise<Response>
}

export type HostLookup = (hostname: string) => Promise<Array<{ address: string; family: number }>>

export class NetworkTransport implements NetworkTransportLike {
  constructor(
    private readonly fetchImplementation: typeof fetch = fetch,
    private readonly lookupHost: HostLookup = defaultLookup
  ) {}

  async request(rawUrl: URL, options: NetworkRequestOptions): Promise<Response> {
    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, options.timeoutMs)
    const cancelRequest = (): void => controller.abort()
    options.signal?.addEventListener('abort', cancelRequest, { once: true })

    try {
      let currentUrl = validateExternalRequestUrl(rawUrl)
      const initialOrigin = currentUrl.origin
      const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS

      for (let redirectCount = 0; ; redirectCount += 1) {
        await this.validateResolvedTarget(currentUrl)
        const response = await this.fetchImplementation(currentUrl, {
          method: options.method,
          headers: options.headers,
          body: options.body,
          redirect: 'manual',
          signal: controller.signal
        })

        if (!isRedirect(response.status)) {
          return response
        }

        if (redirectCount >= maxRedirects) {
          await response.body?.cancel()
          throw new NetworkTransportError('REDIRECT_BLOCKED', '模型服务重定向次数过多')
        }
        if (response.status !== 307 && response.status !== 308) {
          await response.body?.cancel()
          throw new NetworkTransportError('REDIRECT_BLOCKED', '模型服务返回了不安全的重定向')
        }

        const location = response.headers.get('location')
        if (!location) {
          await response.body?.cancel()
          throw new NetworkTransportError('REDIRECT_BLOCKED', '模型服务重定向缺少目标地址')
        }

        let redirectUrl: URL
        try {
          redirectUrl = validateExternalRequestUrl(new URL(location, currentUrl))
        } catch (error) {
          await response.body?.cancel()
          throw error
        }
        if (redirectUrl.origin !== initialOrigin) {
          await response.body?.cancel()
          throw new NetworkTransportError('REDIRECT_BLOCKED', '模型服务不能跨域重定向')
        }

        await response.body?.cancel()
        currentUrl = redirectUrl
      }
    } catch (error) {
      if (error instanceof NetworkTransportError) {
        throw error
      }
      if (error instanceof ExternalUrlPolicyError) {
        throw new NetworkTransportError('ENDPOINT_BLOCKED', error.message)
      }
      if (options.signal?.aborted) {
        throw new NetworkTransportError('NETWORK_CANCELLED', '网络请求已取消')
      }
      if (timedOut) {
        throw new NetworkTransportError('NETWORK_TIMEOUT', '网络请求超时')
      }
      throw new NetworkTransportError('NETWORK_FAILED', '无法连接模型服务')
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', cancelRequest)
    }
  }

  private async validateResolvedTarget(url: URL): Promise<void> {
    const hostname = stripIpv6Brackets(url.hostname)
    if (isIP(hostname)) {
      assertResolvedAddressAllowed(url, hostname)
      return
    }

    const addresses = await this.lookupHost(hostname)
    if (addresses.length === 0) {
      throw new NetworkTransportError('NETWORK_FAILED', '模型服务域名没有可用地址')
    }
    for (const { address } of addresses) {
      assertResolvedAddressAllowed(url, address)
    }
  }
}

async function defaultLookup(hostname: string): ReturnType<HostLookup> {
  return lookup(hostname, { all: true, verbatim: true })
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400
}
