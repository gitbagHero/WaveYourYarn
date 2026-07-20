import { describe, expect, it } from 'vitest'
import { redactSensitiveData, redactText } from './redaction'

describe('diagnostic redaction', () => {
  it('redacts common credential assignments, bearer values and URL queries', () => {
    const input =
      'Cookie: MUSIC_U=music-secret; __csrf=csrf-secret Authorization=Bearer abc123 https://example.com/path?token=url-secret#step'
    const output = redactText(input)

    expect(output).not.toContain('music-secret')
    expect(output).not.toContain('csrf-secret')
    expect(output).not.toContain('abc123')
    expect(output).not.toContain('url-secret')
    expect(output).toContain('[REDACTED]')
    expect(redactText('/Users/alice/Library/app.log')).toBe('/Users/[REDACTED]/Library/app.log')
    expect(redactText('/home/alice/.config/app.log')).toBe('/home/[REDACTED]/.config/app.log')
  })

  it('redacts sensitive object keys recursively without changing safe data', () => {
    const circular: Record<string, unknown> = {
      userId: '123',
      apiKey: 'key-secret',
      nested: {
        authorization: 'Bearer token-secret',
        message: 'request failed at https://example.com/api?cookie=hidden'
      }
    }
    circular.self = circular

    expect(redactSensitiveData(circular)).toEqual({
      userId: '123',
      apiKey: '[REDACTED]',
      nested: {
        authorization: '[REDACTED]',
        message: 'request failed at https://example.com/api?[REDACTED]'
      },
      self: '[Circular]'
    })
  })
})
