import { BlockList, isIP } from 'node:net'

export type ExternalUrlPolicyErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_PROTOCOL'
  | 'CREDENTIALS_NOT_ALLOWED'
  | 'QUERY_NOT_ALLOWED'
  | 'FRAGMENT_NOT_ALLOWED'
  | 'NON_PUBLIC_HOST'
  | 'HTTPS_REQUIRED'

export class ExternalUrlPolicyError extends Error {
  constructor(
    readonly code: ExternalUrlPolicyErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ExternalUrlPolicyError'
  }
}

export interface NormalizedExternalBaseUrl {
  href: string
  origin: string
}

// Keep address families in separate lists. A mixed Node BlockList can match
// IPv4 addresses against IPv4-mapped IPv6 rules.
const blockedIpv4Addresses = new BlockList()
const blockedIpv6Addresses = new BlockList()

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
] as const) {
  blockedIpv4Addresses.addSubnet(network, prefix, 'ipv4')
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8]
] as const) {
  blockedIpv6Addresses.addSubnet(network, prefix, 'ipv6')
}

const LOCAL_DEVELOPMENT_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/**
 * Applies the static part of the outbound LLM endpoint policy.
 *
 * The network transport must additionally validate DNS results and every
 * redirect target immediately before connecting to prevent DNS rebinding.
 */
export function normalizeExternalBaseUrl(rawValue: string): NormalizedExternalBaseUrl {
  const url = parseAndValidateExternalUrl(rawValue)
  url.pathname = ensureTrailingSlash(url.pathname)
  return { href: url.href, origin: url.origin }
}

export function validateExternalRequestUrl(rawValue: string | URL): URL {
  return parseAndValidateExternalUrl(rawValue.toString())
}

export function assertResolvedAddressAllowed(targetUrl: URL, rawAddress: string): void {
  const hostname = stripIpv6Brackets(targetUrl.hostname).toLowerCase()
  const address = stripIpv6Brackets(rawAddress).toLowerCase()
  const isLocalDevelopmentHost = LOCAL_DEVELOPMENT_HOSTS.has(hostname)

  if (isLocalDevelopmentHost) {
    if (address !== '127.0.0.1' && address !== '::1') {
      throw new ExternalUrlPolicyError('NON_PUBLIC_HOST', '本机模型服务地址解析到了非本机回环地址')
    }
    return
  }

  if (isIP(address) === 0 || isNonPublicHostname(address)) {
    throw new ExternalUrlPolicyError('NON_PUBLIC_HOST', '模型服务地址解析到了非公网地址')
  }
}

function parseAndValidateExternalUrl(rawValue: string): URL {
  const value = rawValue.trim()
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new ExternalUrlPolicyError('INVALID_URL', '模型服务地址格式无效')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ExternalUrlPolicyError('UNSUPPORTED_PROTOCOL', '模型服务地址仅支持 HTTP 或 HTTPS')
  }
  if (url.username || url.password) {
    throw new ExternalUrlPolicyError('CREDENTIALS_NOT_ALLOWED', '模型服务地址不能包含用户名或密码')
  }
  if (url.search) {
    throw new ExternalUrlPolicyError('QUERY_NOT_ALLOWED', '模型服务基础地址不能包含查询参数')
  }
  if (url.hash) {
    throw new ExternalUrlPolicyError('FRAGMENT_NOT_ALLOWED', '模型服务基础地址不能包含片段')
  }

  const hostname = stripIpv6Brackets(url.hostname).toLowerCase()
  const isLocalDevelopmentHost = LOCAL_DEVELOPMENT_HOSTS.has(hostname)

  if (!isLocalDevelopmentHost && isNonPublicHostname(hostname)) {
    throw new ExternalUrlPolicyError('NON_PUBLIC_HOST', '模型服务地址必须指向公网主机')
  }
  if (url.protocol !== 'https:' && !isLocalDevelopmentHost) {
    throw new ExternalUrlPolicyError('HTTPS_REQUIRED', '公网模型服务地址必须使用 HTTPS')
  }

  return url
}

function isNonPublicHostname(hostname: string): boolean {
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return true
  }

  const ipVersion = isIP(hostname)
  if (ipVersion === 4) {
    return blockedIpv4Addresses.check(hostname, 'ipv4')
  }
  if (ipVersion === 6) {
    return blockedIpv6Addresses.check(hostname, 'ipv6')
  }

  // Single-label names resolve through local search domains and are unsuitable
  // for an external API endpoint.
  return !hostname.includes('.')
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

function ensureTrailingSlash(pathname: string): string {
  return pathname.endsWith('/') ? pathname : `${pathname}/`
}
