import { randomUUID } from 'node:crypto'
import { rename, rm } from 'node:fs/promises'

export async function replaceFileWithRollback(
  currentPath: string,
  replacementPath: string
): Promise<void> {
  const previousPath = `${currentPath}.restore-previous-${randomUUID()}`
  await rename(currentPath, previousPath)

  try {
    await rename(replacementPath, currentPath)
  } catch (error) {
    await rename(previousPath, currentPath)
    throw error
  }

  await rm(previousPath, { force: true })
}
