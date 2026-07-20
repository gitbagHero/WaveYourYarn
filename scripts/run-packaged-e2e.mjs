import { access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

if (process.platform !== 'darwin') {
  throw new Error('The v0.2.5 packaged smoke runner currently supports macOS only')
}

const executablePath = await findPackagedExecutable()

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const child = spawn(command, ['exec', 'playwright', 'test'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    WYY_E2E_EXECUTABLE_PATH: executablePath
  }
})

const exitCode = await new Promise((resolveExitCode, reject) => {
  child.once('error', reject)
  child.once('exit', (code) => resolveExitCode(code ?? 1))
})

process.exitCode = exitCode

async function findPackagedExecutable() {
  const outputDirectories =
    process.arch === 'arm64' ? ['mac-arm64', 'mac'] : ['mac', 'mac-x64']

  for (const outputDirectory of outputDirectories) {
    const candidate = resolve(
      'release',
      outputDirectory,
      'WaveYourYarn.app',
      'Contents',
      'MacOS',
      'WaveYourYarn'
    )

    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next electron-builder output directory.
    }
  }

  throw new Error(`Cannot find packaged macOS executable for ${process.arch}`)
}
