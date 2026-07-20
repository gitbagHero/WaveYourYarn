import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  isAllowedExternalUrl,
  isAllowedNcmNavigation,
  isTrustedIpcSender,
  isTrustedRendererUrl,
  sanitizeUrlForLog
} from './urlPolicy'

const rendererFilePath = join('/tmp', 'waveyouryarn', 'renderer', 'index.html')

describe('URL security policy', () => {
  it('allows only the explicit HTTPS external host', () => {
    expect(isAllowedExternalUrl('https://music.163.com/song?id=1')).toBe(true)
    expect(isAllowedExternalUrl('http://music.163.com/song?id=1')).toBe(false)
    expect(isAllowedExternalUrl('https://music.163.com.attacker.example')).toBe(false)
    expect(isAllowedExternalUrl('file:///Applications/Calculator.app')).toBe(false)
    expect(isAllowedExternalUrl('not a url')).toBe(false)
  })

  it('allows known NetEase login domains without accepting lookalike hosts', () => {
    expect(isAllowedNcmNavigation('https://music.163.com/')).toBe(true)
    expect(isAllowedNcmNavigation('https://dl.reg.163.com/captcha')).toBe(true)
    expect(isAllowedNcmNavigation('https://passport.163.com/login')).toBe(true)
    expect(isAllowedNcmNavigation('https://reg.163.com.attacker.example')).toBe(false)
    expect(isAllowedNcmNavigation('javascript:alert(1)')).toBe(false)
  })

  it('trusts only the exact production renderer file', () => {
    const rendererUrl = pathToFileURL(rendererFilePath).toString()

    expect(isTrustedRendererUrl(rendererUrl, { rendererFilePath })).toBe(true)
    expect(isTrustedRendererUrl(`${rendererUrl}?source=e2e#settings`, { rendererFilePath })).toBe(true)
    expect(
      isTrustedRendererUrl(pathToFileURL(join('/tmp', 'attacker.html')).toString(), {
        rendererFilePath
      })
    ).toBe(false)
  })

  it('trusts the configured development origin only', () => {
    const policy = {
      rendererFilePath,
      devServerUrl: 'http://127.0.0.1:5173'
    }

    expect(isTrustedRendererUrl('http://127.0.0.1:5173/settings', policy)).toBe(true)
    expect(isTrustedRendererUrl('http://localhost:5173/settings', policy)).toBe(false)
    expect(isTrustedRendererUrl('https://127.0.0.1:5173/settings', policy)).toBe(false)
  })

  it('rejects IPC from child frames even on the trusted renderer URL', () => {
    const rendererUrl = pathToFileURL(rendererFilePath).toString()
    const policy = { rendererFilePath }

    expect(isTrustedIpcSender(rendererUrl, true, policy)).toBe(true)
    expect(isTrustedIpcSender(rendererUrl, false, policy)).toBe(false)
    expect(isTrustedIpcSender('https://music.163.com', true, policy)).toBe(false)
  })

  it('removes query strings, fragments and local paths from logged URLs', () => {
    expect(sanitizeUrlForLog('https://music.163.com/login?token=secret#step')).toBe(
      'https://music.163.com/login'
    )
    expect(sanitizeUrlForLog(pathToFileURL(rendererFilePath).toString())).toBe(
      'file://[local-renderer]'
    )
    expect(sanitizeUrlForLog('invalid')).toBe('[invalid-url]')
  })
})
