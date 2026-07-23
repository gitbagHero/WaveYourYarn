import { lookup } from 'node:dns/promises'
import { request as requestHttp, type IncomingMessage, type RequestOptions } from 'node:http'
import { request as requestHttps } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import {
  assertResolvedAddressAllowed,
  ExternalUrlPolicyError,
  validateExternalRequestUrl
} from './externalUrlPolicy'

const DEFAULT_MAX_REDIRECTS = 2
const MAX_RESPONSE_BYTES = 2_000_000

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

export interface ResolvedTarget {
  address: string
  family: 4 | 6
}

export interface PinnedRequestOptions {
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  signal: AbortSignal
}

export type PinnedRequestExecutor = (
  url: URL,
  options: PinnedRequestOptions,
  target: ResolvedTarget
) => Promise<Response>

export class NetworkTransport implements NetworkTransportLike {
  constructor(
    private readonly executePinnedRequest: PinnedRequestExecutor = defaultPinnedRequest,
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
        const resolvedTarget = await this.resolveAndValidateTarget(currentUrl)
        const response = await this.executePinnedRequest(
          currentUrl,
          {
            method: options.method,
            headers: options.headers,
            body: options.body,
            signal: controller.signal
          },
          resolvedTarget
        )

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

  private async resolveAndValidateTarget(url: URL): Promise<ResolvedTarget> {
    const hostname = stripIpv6Brackets(url.hostname)
    const literalFamily = isIP(hostname)
    if (literalFamily === 4 || literalFamily === 6) {
      assertResolvedAddressAllowed(url, hostname)
      return { address: hostname, family: literalFamily }
    }

    const addresses = await this.lookupHost(hostname)
    if (addresses.length === 0) {
      throw new NetworkTransportError('NETWORK_FAILED', '模型服务域名没有可用地址')
    }
    let selectedTarget: ResolvedTarget | undefined
    for (const { address } of addresses) {
      assertResolvedAddressAllowed(url, address)
      const family = isIP(address)
      if (family !== 4 && family !== 6) {
        throw new NetworkTransportError('NETWORK_FAILED', '模型服务域名返回了无效地址')
      }
      selectedTarget ??= { address, family }
    }
    return selectedTarget!
  }
}

async function defaultLookup(hostname: string): ReturnType<HostLookup> {
  return lookup(hostname, { all: true, verbatim: true })
}

function defaultPinnedRequest(
  url: URL,
  options: PinnedRequestOptions,
  target: ResolvedTarget
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const requestOptions: RequestOptions = {
      method: options.method,
      headers: options.headers,
      signal: options.signal,
      lookup: createPinnedLookup(target)
    }
    const sendRequest = url.protocol === 'https:' ? requestHttps : requestHttp
    const request = sendRequest(url, requestOptions, (incoming) => {
      collectResponse(incoming).then(resolve, reject)
    })
    request.once('error', reject)
    request.end(options.body)
  })
}

function createPinnedLookup(target: ResolvedTarget): LookupFunction {
  return (_hostname, lookupOptions, callback) => {
    if (lookupOptions.all) {
      callback(null, [{ address: target.address, family: target.family }])
      return
    }
    callback(null, target.address, target.family)
  }
}

function collectResponse(incoming: IncomingMessage): Promise<Response> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let receivedBytes = 0

    incoming.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      receivedBytes += buffer.length
      if (receivedBytes > MAX_RESPONSE_BYTES) {
        incoming.destroy(new Error('Response exceeds the transport size limit.'))
        return
      }
      chunks.push(buffer)
    })
    incoming.once('aborted', () => reject(new Error('Response was aborted.')))
    incoming.once('error', reject)
    incoming.once('end', () => {
      const status = incoming.statusCode ?? 500
      const headers = new Headers()
      for (const [name, rawValue] of Object.entries(incoming.headers)) {
        if (Array.isArray(rawValue)) {
          rawValue.forEach((value) => headers.append(name, value))
        } else if (rawValue !== undefined) {
          headers.set(name, String(rawValue))
        }
      }
      const body = status === 204 || status === 205 || status === 304 ? null : Buffer.concat(chunks)
      resolve(
        new Response(body, {
          status,
          statusText: incoming.statusMessage,
          headers
        })
      )
    })
  })
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400
}
