import { appendFile, mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { redactSensitiveData, redactText } from './redaction'

type LogLevel = 'info' | 'warn' | 'error'

interface StructuredLogEntry {
  timestamp: string
  level: LogLevel
  message: string
  detail?: unknown
}

const MAX_LOG_SIZE_BYTES = 2 * 1024 * 1024
const MAX_LOG_FILES = 3
let logFilePath: string | null = null
let writeQueue: Promise<void> = Promise.resolve()

export async function configureFileLogging(logDirectory: string): Promise<void> {
  await mkdir(logDirectory, { recursive: true })
  logFilePath = join(logDirectory, 'waveyouryarn.log')
  await rotateLogsIfNeeded(logFilePath)
}

export function getLogFilePath(): string | null {
  return logFilePath
}

export async function readRecentRedactedLogs(maxLines = 500): Promise<string[]> {
  await writeQueue

  if (!logFilePath) {
    return []
  }

  try {
    const content = await readFile(logFilePath, 'utf8')
    return content.split(/\r?\n/).filter(Boolean).slice(-maxLines).map(redactText)
  } catch {
    return []
  }
}

export async function flushLogWrites(): Promise<void> {
  await writeQueue
}

export const logger = {
  info(message: string, detail?: unknown): void {
    writeLog('info', message, detail)
  },
  warn(message: string, detail?: unknown): void {
    writeLog('warn', message, detail)
  },
  error(message: string, detail?: unknown): void {
    writeLog('error', message, detail)
  }
}

function writeLog(level: LogLevel, message: string, detail?: unknown): void {
  const safeMessage = redactText(message)
  const safeDetail = detail === undefined ? undefined : redactSensitiveData(detail)
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: safeMessage,
    ...(safeDetail === undefined ? {} : { detail: safeDetail })
  }
  const consoleMethod =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.info
  consoleMethod(`[WaveYourYarn] ${safeMessage}`, safeDetail ?? '')

  if (!logFilePath) {
    return
  }

  const targetPath = logFilePath
  writeQueue = writeQueue
    .then(async () => {
      await rotateLogsIfNeeded(targetPath)
      await appendFile(targetPath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 })
    })
    .catch((error) => {
      console.error('[WaveYourYarn] Failed to write application log', redactSensitiveData(error))
    })
}

async function rotateLogsIfNeeded(targetPath: string): Promise<void> {
  try {
    const info = await stat(targetPath)

    if (info.size < MAX_LOG_SIZE_BYTES) {
      return
    }
  } catch {
    return
  }

  await rm(`${targetPath}.${MAX_LOG_FILES}`, { force: true })

  for (let index = MAX_LOG_FILES - 1; index >= 1; index -= 1) {
    try {
      await rename(`${targetPath}.${index}`, `${targetPath}.${index + 1}`)
    } catch {
      // Missing older logs are expected.
    }
  }

  await rename(targetPath, `${targetPath}.1`)
}
