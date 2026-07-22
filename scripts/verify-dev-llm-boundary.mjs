import { readFile, readdir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { listPackage } from '@electron/asar'

const rootDirectory = resolve(import.meta.dirname, '..')
const localEnvironmentPaths = [
  join(rootDirectory, '.env.development.local'),
  join(rootDirectory, '.env.local'),
  join(rootDirectory, '.env')
]
const requestedTargets = process.argv.slice(2)
const targetNames =
  requestedTargets[0] === '--current-package'
    ? [getCurrentPackageDirectory()]
    : requestedTargets.length > 0
      ? requestedTargets
      : ['out']
const targetDirectories = targetNames.map((directory) => resolve(rootDirectory, directory))
const scansApplicationOutput = targetDirectories.some(
  (directory) => directory === join(rootDirectory, 'out')
)
const protectedKeys = ['WYY_DEV_LLM_BASE_URL', 'WYY_DEV_LLM_MODEL_ID', 'WYY_DEV_LLM_API_KEY']

const outputFiles = (
  await Promise.all(targetDirectories.map((directory) => collectFiles(directory)))
).flat()
const forbiddenEnvironmentFiles = outputFiles.filter((filePath) =>
  isEnvironmentFileName(basename(filePath))
)

if (forbiddenEnvironmentFiles.length > 0) {
  fail('A local environment file was copied into the production build output.')
}

for (const archivePath of outputFiles.filter((filePath) => basename(filePath) === 'app.asar')) {
  const archivedEnvironmentFile = listPackage(archivePath, { isPack: false }).find((filePath) =>
    isEnvironmentFileName(basename(filePath))
  )

  if (archivedEnvironmentFile) {
    fail('An environment file was included inside a packaged app.asar archive.')
  }
}

const configuredSecrets = mergeProtectedValues(
  await Promise.all(localEnvironmentPaths.map((filePath) => readProtectedValues(filePath)))
)

for (const filePath of outputFiles) {
  const content = await readFile(filePath)

  for (const { key, value } of configuredSecrets) {
    if (containsProtectedValue(content, value, scansApplicationOutput)) {
      fail(`A development-only value from ${key} was embedded in the production build output.`)
    }
  }
}

console.log('Development LLM release boundary verified.')

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)))
    } else if (entry.isFile() && !isCompressedInstaller(entry.name)) {
      files.push(entryPath)
    }
  }

  return files
}

function isCompressedInstaller(fileName) {
  return ['.dmg', '.zip', '.7z', '.blockmap'].some((extension) => fileName.endsWith(extension))
}

function isEnvironmentFileName(fileName) {
  return fileName === '.env' || fileName.startsWith('.env.')
}

function getCurrentPackageDirectory() {
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'release/mac-arm64' : 'release/mac'
  }

  if (process.platform === 'win32') {
    return process.arch === 'arm64' ? 'release/win-arm64-unpacked' : 'release/win-unpacked'
  }

  throw new Error(`Packaged boundary verification is not configured for ${process.platform}.`)
}

async function readProtectedValues(filePath) {
  let content

  try {
    content = await readFile(filePath, 'utf8')
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return []
    }
    throw error
  }

  const valuesByKey = new Map()
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/u)
    if (match) {
      valuesByKey.set(match[1], stripOptionalQuotes(match[2].trim()))
    }
  }

  return protectedKeys
    .map((key) => ({ key, value: valuesByKey.get(key) ?? '' }))
    .filter(({ value }) => value.length > 0)
}

function mergeProtectedValues(valueGroups) {
  const valuesByKey = new Map()

  for (const values of valueGroups) {
    for (const entry of values) {
      if (!valuesByKey.has(entry.key)) {
        valuesByKey.set(entry.key, entry)
      }
    }
  }

  return [...valuesByKey.values()]
}

function stripOptionalQuotes(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function containsProtectedValue(content, value, includeShortValues) {
  if (value.length >= 8) {
    return content.includes(Buffer.from(value))
  }

  // Very short model IDs can collide with unrelated strings inside packaged dependencies.
  // They are checked in the application-owned `out` tree before packaging; package scans
  // still reject copied env files and longer Base URL/API key values.
  if (!includeShortValues) {
    return false
  }

  const text = content.toString('utf8')
  return [`"${value}"`, `'${value}'`, `\`${value}\``].some((quoted) => text.includes(quoted))
}

function fail(message) {
  console.error(message)
  process.exitCode = 1
  process.exit()
}
