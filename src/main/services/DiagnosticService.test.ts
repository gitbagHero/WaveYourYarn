import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDatabase } from '../db/testing/createTestDatabase'
import type { DiagnosticRuntimeInfo } from '../types/diagnostics'
import { DiagnosticService } from './DiagnosticService'

const runtime: DiagnosticRuntimeInfo = {
  appVersion: '0.2.5',
  electronVersion: '33.4.11',
  chromiumVersion: '130.0.0.0',
  nodeVersion: '22.0.0',
  platform: 'darwin',
  architecture: 'arm64',
  locale: 'zh-CN',
  safeStorageAvailable: true
}

describe('DiagnosticService', () => {
  const databases: Database.Database[] = []
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    for (const database of databases.splice(0)) {
      database.close()
    }

    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true })
      )
    )
  })

  it('reports only aggregate database information and public setting counts', async () => {
    const directory = await createTemporaryDirectory(temporaryDirectories)
    const databasePath = join(directory, 'waveyouryarn.db')
    await writeFile(databasePath, 'size-placeholder')
    const db = createTestDatabase()
    databases.push(db)
    db.exec(`
      INSERT INTO app_settings (id, key, value, updated_at)
      VALUES ('public', 'default_export_directory', '/tmp', 'now');
      INSERT INTO app_settings (id, key, value, updated_at)
      VALUES ('secret', 'secret:ncm_cookie', 'safe:credential', 'now');
      INSERT INTO songs (
        id, ncm_song_id, name, artists_json, created_at, updated_at
      ) VALUES ('song-1', '1', 'Private song title', '[]', 'now', 'now');
    `)
    const service = new DiagnosticService(
      db,
      { appDataDirectory: directory, databasePath },
      async () => []
    )

    const summary = await service.getSummary(runtime)

    expect(summary.database.integrity).toBe('ok')
    expect(summary.database.counts.songs).toBe(1)
    expect(summary.database.counts.publicSettings).toBe(1)
    expect(JSON.stringify(summary)).not.toContain('Private song title')
    expect(JSON.stringify(summary)).not.toContain('credential')
  })

  it('redacts credentials and URL queries again when exporting diagnostics', async () => {
    const directory = await createTemporaryDirectory(temporaryDirectories)
    const databasePath = join(directory, 'waveyouryarn.db')
    const destinationPath = join(directory, 'diagnostics.json')
    await writeFile(databasePath, 'size-placeholder')
    const db = createTestDatabase()
    databases.push(db)
    const service = new DiagnosticService(
      db,
      { appDataDirectory: directory, databasePath },
      async () => [
        'Cookie: MUSIC_U=private-cookie',
        'Authorization: Bearer private-token',
        'https://example.com/request?apiKey=private-key'
      ]
    )

    const result = await service.exportDiagnostics(destinationPath, runtime)
    const content = await readFile(destinationPath, 'utf8')

    expect(result.fileName).toBe('diagnostics.json')
    expect(content).not.toContain('private-cookie')
    expect(content).not.toContain('private-token')
    expect(content).not.toContain('private-key')
    expect(content).toContain('[REDACTED]')
  })
})

async function createTemporaryDirectory(registry: string[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'waveyouryarn-diagnostics-'))
  registry.push(directory)
  return directory
}
