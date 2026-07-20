import { mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

if (process.platform !== 'darwin') {
  throw new Error('ICNS generation currently requires macOS iconutil')
}

const sourcePath = resolve('assets/icon.svg')
const buildDirectory = resolve('build')
const iconsetPath = resolve(buildDirectory, 'icon.iconset')
const outputPath = resolve(buildDirectory, 'icon.icns')
const sizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
]

await rm(iconsetPath, { recursive: true, force: true })
await mkdir(iconsetPath, { recursive: true })

for (const [fileName, size] of sizes) {
  run('rsvg-convert', [
    '--width',
    String(size),
    '--height',
    String(size),
    '--output',
    resolve(iconsetPath, String(fileName)),
    sourcePath
  ])
}

run('iconutil', ['--convert', 'icns', iconsetPath, '--output', outputPath])
await rm(iconsetPath, { recursive: true, force: true })
console.info(`Generated ${outputPath}`)

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`)
  }
}
