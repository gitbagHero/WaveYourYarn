import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { replaceFileWithRollback } from './atomicFileReplacement'

describe('replaceFileWithRollback', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true })
      )
    )
  })

  it('replaces the current file', async () => {
    const directory = await createTemporaryDirectory(temporaryDirectories)
    const currentPath = join(directory, 'current.db')
    const replacementPath = join(directory, 'replacement.db')
    await writeFile(currentPath, 'old')
    await writeFile(replacementPath, 'new')

    await replaceFileWithRollback(currentPath, replacementPath)

    expect(await readFile(currentPath, 'utf8')).toBe('new')
  })

  it('restores the current file when moving the replacement fails', async () => {
    const directory = await createTemporaryDirectory(temporaryDirectories)
    const currentPath = join(directory, 'current.db')
    await writeFile(currentPath, 'old')

    await expect(
      replaceFileWithRollback(currentPath, join(directory, 'missing.db'))
    ).rejects.toThrow()
    expect(await readFile(currentPath, 'utf8')).toBe('old')
  })
})

async function createTemporaryDirectory(registry: string[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'waveyouryarn-atomic-file-'))
  registry.push(directory)
  return directory
}
