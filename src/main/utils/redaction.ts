const SENSITIVE_KEY_PATTERN = /(?:^|[_-])(authorization|cookie|token|api[_-]?key|secret|music[_-]?u|csrf)(?:$|[_-])/i
const SENSITIVE_ASSIGNMENT_PATTERN = /((?:MUSIC_U|__csrf|cookie|authorization|api[_ -]?key|token|secret)\s*[:=]\s*)([^;\s,}\]]+)/gi
const BEARER_PATTERN = /\bBearer\s+[^\s,;]+/gi
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi
const POSIX_USER_PATH_PATTERN = /\/(?:Users|home)\/[^/\s"']+/g
const WINDOWS_USER_PATH_PATTERN = /[A-Za-z]:\\Users\\[^\\\s"']+/g

export function redactText(value: string): string {
  return value
    .replace(URL_PATTERN, (candidate) => redactUrl(candidate))
    .replace(POSIX_USER_PATH_PATTERN, (candidate) =>
      candidate.startsWith('/Users/') ? '/Users/[REDACTED]' : '/home/[REDACTED]'
    )
    .replace(WINDOWS_USER_PATH_PATTERN, 'C:\\Users\\[REDACTED]')
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, '$1[REDACTED]')
}

export function redactSensitiveData(value: unknown, maxDepth = 6): unknown {
  return redactValue(value, new WeakSet<object>(), 0, maxDepth)
}

function redactValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
  maxDepth: number
): unknown {
  if (typeof value === 'string') {
    return redactText(value)
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
      stack: value.stack ? redactText(value.stack) : undefined
    }
  }

  if (typeof value !== 'object') {
    return redactText(String(value))
  }

  if (seen.has(value)) {
    return '[Circular]'
  }

  if (depth >= maxDepth) {
    return '[MaxDepth]'
  }

  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen, depth + 1, maxDepth))
  }

  const result: Record<string, unknown> = {}

  for (const [key, item] of Object.entries(value)) {
    result[key] = isSensitiveKey(key)
      ? '[REDACTED]'
      : redactValue(item, seen, depth + 1, maxDepth)
  }

  return result
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
  return SENSITIVE_KEY_PATTERN.test(`_${normalized}_`)
}

function redactUrl(candidate: string): string {
  try {
    const url = new URL(candidate)

    if (url.search) {
      url.search = '?[REDACTED]'
    }

    if (url.hash) {
      url.hash = '#[REDACTED]'
    }

    return url.toString()
  } catch {
    return '[REDACTED_URL]'
  }
}
