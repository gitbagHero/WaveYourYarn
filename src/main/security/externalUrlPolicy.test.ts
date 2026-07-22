import { describe, expect, it } from 'vitest'
import { ExternalUrlPolicyError, normalizeExternalBaseUrl } from './externalUrlPolicy'

describe('externalUrlPolicy', () => {
  it('normalizes public HTTPS and preserves a nested API path', () => {
    expect(normalizeExternalBaseUrl(' https://llm.example.test/nested/v1 ')).toEqual({
      href: 'https://llm.example.test/nested/v1/',
      origin: 'https://llm.example.test'
    })
  })

  it.each(['http://localhost:11434/v1', 'http://127.0.0.1:11434/v1', 'http://[::1]:11434/v1'])(
    'allows the exact local development endpoint %s',
    (value) => {
      expect(normalizeExternalBaseUrl(value).href).toMatch(/\/v1\/$/)
    }
  )

  it.each([
    ['http://api.example.test/v1', 'HTTPS_REQUIRED'],
    ['https://user:password@api.example.test/v1', 'CREDENTIALS_NOT_ALLOWED'],
    ['https://api.example.test/v1?token=secret', 'QUERY_NOT_ALLOWED'],
    ['https://api.example.test/v1#fragment', 'FRAGMENT_NOT_ALLOWED'],
    ['file:///tmp/model', 'UNSUPPORTED_PROTOCOL'],
    ['https://192.168.1.2/v1', 'NON_PUBLIC_HOST'],
    ['https://127.0.0.2/v1', 'NON_PUBLIC_HOST'],
    ['https://169.254.169.254/latest', 'NON_PUBLIC_HOST'],
    ['https://[fe80::1]/v1', 'NON_PUBLIC_HOST'],
    ['https://internal/v1', 'NON_PUBLIC_HOST']
  ] as const)('rejects unsafe endpoint %s', (value, code) => {
    expect(() => normalizeExternalBaseUrl(value)).toThrowError(
      expect.objectContaining<Partial<ExternalUrlPolicyError>>({ code })
    )
  })
})
