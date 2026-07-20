import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface RendererLocationPolicy {
  devServerUrl?: string
  rendererFilePath: string
}

const EXTERNAL_HOSTS = new Set(['music.163.com'])
const NCM_NAVIGATION_DOMAINS = ['music.163.com', 'reg.163.com', 'passport.163.com']

export function isAllowedExternalUrl(rawUrl: string): boolean {
  const url = parseUrl(rawUrl)
  return Boolean(url && url.protocol === 'https:' && EXTERNAL_HOSTS.has(url.hostname))
}

export function isAllowedNcmNavigation(rawUrl: string): boolean {
  const url = parseUrl(rawUrl)

  if (!url || url.protocol !== 'https:') {
    return false
  }

  return NCM_NAVIGATION_DOMAINS.some(
    (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
  )
}

export function isTrustedRendererUrl(
  rawUrl: string,
  { devServerUrl, rendererFilePath }: RendererLocationPolicy
): boolean {
  const url = parseUrl(rawUrl)

  if (!url) {
    return false
  }

  if (devServerUrl) {
    const devUrl = parseUrl(devServerUrl)

    if (devUrl && url.origin === devUrl.origin) {
      return true
    }
  }

  if (url.protocol !== 'file:') {
    return false
  }

  try {
    return resolve(fileURLToPath(url)) === resolve(rendererFilePath)
  } catch {
    return false
  }
}

export function isTrustedIpcSender(
  senderUrl: string,
  isMainFrame: boolean,
  policy: RendererLocationPolicy
): boolean {
  return isMainFrame && isTrustedRendererUrl(senderUrl, policy)
}

export function sanitizeUrlForLog(rawUrl: string): string {
  const url = parseUrl(rawUrl)

  if (!url) {
    return '[invalid-url]'
  }

  if (url.protocol === 'file:') {
    return 'file://[local-renderer]'
  }

  return `${url.protocol}//${url.host}${url.pathname}`
}

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl)
  } catch {
    return null
  }
}
