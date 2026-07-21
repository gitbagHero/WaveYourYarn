import { spawnSync } from 'node:child_process'

function runPnpm(args) {
  const result = spawnSync('pnpm', args, {
    stdio: 'inherit'
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(' ')} exited with code ${result.status ?? 'unknown'}`)
  }
}

let packagingError = null

try {
  runPnpm(['run', 'build'])
  runPnpm([
    'exec',
    'electron-builder',
    '--mac',
    'dmg',
    'zip',
    '--arm64',
    '--x64',
    '--publish',
    'never'
  ])
} catch (error) {
  packagingError = error
} finally {
  try {
    // Cross-architecture packaging rewrites native modules in node_modules.
    // Restore the current host architecture so the next local Electron run is usable.
    runPnpm(['run', 'rebuild:native'])
  } catch (error) {
    if (packagingError) {
      console.error('Failed to restore native modules after the packaging failure.', error)
    } else {
      packagingError = error
    }
  }
}

if (packagingError) {
  console.error(packagingError)
  process.exitCode = 1
}
