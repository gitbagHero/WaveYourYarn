import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configureFileLogging, flushLogWrites, getLogFilePath, logger } from './logger'

describe('structured file logger', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await flushLogWrites()
    vi.restoreAllMocks()
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true }))
    )
  })

  it('redacts credentials and rotates a file that crosses the size limit during runtime', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const directory = await mkdtemp(join(tmpdir(), 'waveyouryarn-logger-'))
    temporaryDirectories.push(directory)
    await configureFileLogging(directory)
    const logPath = getLogFilePath()

    expect(logPath).toBeTruthy()
    logger.info('x'.repeat(2 * 1024 * 1024 + 1), { token: 'private-token' })
    await flushLogWrites()
    logger.info('entry after rotation', { authorization: 'Bearer another-secret' })
    await flushLogWrites()

    const current = await readFile(logPath!, 'utf8')
    const rotated = await readFile(`${logPath}.1`, 'utf8')
    expect(current).toContain('entry after rotation')
    expect(current).not.toContain('another-secret')
    expect(rotated).not.toContain('private-token')
    expect((await stat(`${logPath}.1`)).size).toBeGreaterThan(2 * 1024 * 1024)
  })
})
