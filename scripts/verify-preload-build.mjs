import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const preloadPath = resolve('out/preload/index.cjs')

let preloadSource

try {
  preloadSource = await readFile(preloadPath, 'utf8')
} catch (error) {
  throw new Error(`Sandbox-compatible preload bundle is missing: ${preloadPath}`, {
    cause: error
  })
}

if (/^\s*import\s/m.test(preloadSource)) {
  throw new Error('Sandboxed preload bundle must use CommonJS instead of ESM imports')
}

if (!/exposeInMainWorld\(["']waveYourYarn["']/.test(preloadSource)) {
  throw new Error('Preload bundle does not expose the WaveYourYarn context bridge')
}

console.info('Verified sandbox-compatible preload bridge: out/preload/index.cjs')
