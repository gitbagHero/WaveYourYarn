import { toErrorMessage } from './errors'

function serialize(value: unknown): string {
  if (value instanceof Error) {
    return value.stack ?? value.message
  }

  return toErrorMessage(value)
}

export const logger = {
  info(message: string, detail?: unknown): void {
    console.info(`[WaveYourYarn] ${message}`, detail ?? '')
  },
  warn(message: string, detail?: unknown): void {
    console.warn(`[WaveYourYarn] ${message}`, detail ?? '')
  },
  error(message: string, detail?: unknown): void {
    console.error(`[WaveYourYarn] ${message}`, detail ? serialize(detail) : '')
  }
}
