import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { _electron as electron, expect, test, type Page } from '@playwright/test'
import { extractBackupArchive } from '../src/main/utils/backupFormat'
import type { WaveYourYarnApi } from '../src/preload/types'

test('production build exposes preload IPC and renders the primary routes', async () => {
  const userDataDir = await mkdtemp(resolve(tmpdir(), 'waveyouryarn-e2e-'))
  const executablePath = process.env.WYY_E2E_EXECUTABLE_PATH
  const electronApp = await electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: executablePath ? [] : [resolve('.')],
    env: {
      ...process.env,
      WYY_E2E_USER_DATA_DIR: userDataDir
    }
  })

  try {
    const window = await electronApp.firstWindow()
    await expect(window).toHaveTitle('WaveYourYarn')
    await expect(window.getByRole('heading', { name: 'WaveYourYarn', exact: true }).first()).toBeVisible()

    const bridgeResult = await window.evaluate(async () => {
      const bridge = (
        globalThis as typeof globalThis & {
          waveYourYarn?: {
            app?: { ping?: () => Promise<{ success: boolean; data?: string }> }
          }
        }
      ).waveYourYarn

      if (!bridge?.app?.ping) {
        return { available: false, ping: null }
      }

      return {
        available: true,
        ping: await bridge.app.ping()
      }
    })

    expect(bridgeResult).toEqual({
      available: true,
      ping: { success: true, data: 'pong' }
    })
    await expect(window.getByText('IPC ping result: pong')).toBeVisible()

    await electronApp.evaluate(async ({ app }) => {
      const { createRequire } = process.getBuiltinModule('node:module')
      const { join } = process.getBuiltinModule('node:path')
      const require = createRequire(join(app.getAppPath(), 'package.json'))
      const Database = require('better-sqlite3') as typeof import('better-sqlite3')
      const database = new Database(
        join(app.getPath('userData'), 'WaveYourYarn', 'waveyouryarn.db')
      )
      database
        .prepare(
          `INSERT INTO app_settings (id, key, value, updated_at)
           VALUES (?, ?, ?, ?)`
        )
        .run('e2e-secret', 'secret:e2e-cookie', 'safe:fake-sensitive-value', new Date().toISOString())
      database.close()
    })

    const backupPath = resolve(userDataDir, 'e2e-smoke.wyybackup')
    await electronApp.evaluate(({ dialog }, selectedPath) => {
      dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: selectedPath })
    }, backupPath)
    const createBackupResult = await window.evaluate(async () => {
      const bridge = globalThis as typeof globalThis & {
        waveYourYarn: {
          backup: {
            create: () => Promise<{ success: boolean; data?: { fileName: string } | null }>
          }
        }
      }
      return bridge.waveYourYarn.backup.create()
    })
    expect(createBackupResult.success).toBe(true)
    expect(createBackupResult.data?.fileName).toBe('e2e-smoke.wyybackup')
    const backupHeader = (await readFile(backupPath)).subarray(0, 10).toString('utf8')
    expect(backupHeader).toBe('WYYBACKUP\n')
    const extractedBackupPath = resolve(userDataDir, 'e2e-extracted.db')
    await extractBackupArchive(backupPath, extractedBackupPath)
    const extractedDatabase = await readFile(extractedBackupPath)
    expect(extractedDatabase.includes(Buffer.from('secret:e2e-cookie'))).toBe(false)
    expect(extractedDatabase.includes(Buffer.from('fake-sensitive-value'))).toBe(false)

    await electronApp.evaluate(({ dialog }, selectedPath) => {
      dialog.showOpenDialog = () =>
        Promise.resolve({ canceled: false, filePaths: [selectedPath] })
    }, backupPath)
    const restoreSelectionResult = await window.evaluate(async () => {
      const bridge = globalThis as typeof globalThis & {
        waveYourYarn: {
          backup: {
            selectForRestore: () => Promise<{
              success: boolean
              data?: { token: string; preview: { schemaVersion: number } } | null
            }>
          }
        }
      }
      return bridge.waveYourYarn.backup.selectForRestore()
    })
    expect(restoreSelectionResult.success).toBe(true)
    expect(restoreSelectionResult.data?.token).toBeTruthy()
    expect(restoreSelectionResult.data?.preview.schemaVersion).toBeGreaterThan(0)

    const diagnosticSummaryResult = await window.evaluate(async () => {
      const bridge = globalThis as typeof globalThis & {
        waveYourYarn: {
          diagnostics: {
            getSummary: () => Promise<{
              success: boolean
              data?: { application: { version: string }; database: { schemaVersion: number } }
            }>
          }
        }
      }
      return bridge.waveYourYarn.diagnostics.getSummary()
    })
    expect(diagnosticSummaryResult.success).toBe(true)
    expect(diagnosticSummaryResult.data?.application.version).toBe('0.2.5')
    expect(diagnosticSummaryResult.data?.database.schemaVersion).toBeGreaterThan(0)

    const diagnosticPath = resolve(userDataDir, 'e2e-diagnostics.json')
    await electronApp.evaluate(({ dialog }, selectedPath) => {
      dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: selectedPath })
    }, diagnosticPath)
    const diagnosticExportResult = await window.evaluate(async () => {
      const bridge = globalThis as typeof globalThis & {
        waveYourYarn: {
          diagnostics: {
            export: () => Promise<{ success: boolean; data?: { fileName: string } | null }>
          }
        }
      }
      return bridge.waveYourYarn.diagnostics.export()
    })
    expect(diagnosticExportResult.success).toBe(true)
    expect(diagnosticExportResult.data?.fileName).toBe('e2e-diagnostics.json')
    const diagnosticContent = await readFile(diagnosticPath, 'utf8')
    expect(diagnosticContent).not.toContain('fake-sensitive-value')
    expect(diagnosticContent).not.toContain('secret:e2e-cookie')
    expect(diagnosticContent).not.toContain(userDataDir)

    const routes = [
      { label: '网易云登录', hash: '#/login', heading: '连接网易云音乐' },
      { label: '我喜欢的音乐', hash: '#/liked-songs', heading: '我喜欢的音乐' },
      { label: '歌单', hash: '#/playlists', heading: '我的歌单' },
      { label: '数据导出', hash: '#/export', heading: '数据导出' },
      { label: '数据统计', hash: '#/statistics', heading: '数据统计' },
      { label: 'AI 音乐报告', hash: '#/ai-reports', heading: 'AI 音乐报告' },
      { label: '设置', hash: '#/settings', heading: '设置' }
    ]

    for (const route of routes) {
      await window.getByRole('link', { name: route.label, exact: true }).click()
      await expect(window).toHaveURL(new RegExp(`${route.hash.replace('/', '\\/')}$`))
      await expect(window.getByRole('heading', { name: route.heading, exact: true }).first()).toBeVisible()
    }

    await expect(window.getByRole('heading', { name: 'AI 模型配置', exact: true })).toBeVisible()
    await expect(window.getByRole('heading', { name: 'AI 数据披露', exact: true })).toBeVisible()
    const disclosurePreferencesResult = await window.evaluate(async () => {
      const bridge = globalThis as typeof globalThis & {
        waveYourYarn: {
          aiDisclosure: {
            getPreferences: () => Promise<{
              success: boolean
              data?: { confirmationMode: string; rememberedConsentCount: number }
            }>
          }
        }
      }
      return bridge.waveYourYarn.aiDisclosure.getPreferences()
    })
    expect(disclosurePreferencesResult).toEqual({
      success: true,
      data: { confirmationMode: 'allow_remembered', rememberedConsentCount: 0 }
    })
    const reportHistoryResult = await window.evaluate(async () => {
      const bridge = globalThis as typeof globalThis & {
        waveYourYarn: {
          aiReports: {
            list: () => Promise<{ success: boolean; data?: unknown[] }>
          }
        }
      }
      return bridge.waveYourYarn.aiReports.list()
    })
    expect(reportHistoryResult).toEqual({ success: true, data: [] })
  } finally {
    await electronApp.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
})

test('AI report IPC handles mock provider success, cancellation, invalid output and auth failure', async () => {
  const mockProvider = await startMockProvider()
  const userDataDir = await mkdtemp(resolve(tmpdir(), 'waveyouryarn-ai-e2e-'))
  const executablePath = process.env.WYY_E2E_EXECUTABLE_PATH
  const electronApp = await electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: executablePath ? [] : [resolve('.')],
    env: {
      ...process.env,
      WYY_E2E_USER_DATA_DIR: userDataDir
    }
  })

  try {
    const window = await electronApp.firstWindow()
    await seedLikedSong(electronApp)
    const profileId = await createMockProfile(window, mockProvider.baseUrl)

    const succeeded = await startReport(window, profileId)
    const succeededJob = await waitForJob(window, succeeded)
    expect(succeededJob).toMatchObject({ status: 'succeeded', stage: 'completed' })
    const report = await getReportByJob(window, succeeded)
    expect(report).toMatchObject({
      success: true,
      data: {
        report: {
          modelId: 'success',
          promptTemplateVersion: 3,
          userTitle: 'E2E 音乐报告'
        }
      }
    })

    await updateProfileModel(window, profileId, 'invalid')
    const invalid = await waitForJob(window, await startReport(window, profileId))
    expect(invalid).toMatchObject({ status: 'failed', errorCode: 'LLM_OUTPUT_INVALID' })

    await updateProfileModel(window, profileId, 'auth')
    const authFailed = await waitForJob(window, await startReport(window, profileId))
    expect(authFailed).toMatchObject({ status: 'failed', errorCode: 'LLM_AUTH_FAILED' })

    await updateProfileModel(window, profileId, 'slow')
    const slowJobId = await startReport(window, profileId)
    await expect
      .poll(() => mockProvider.requests.some(({ model }) => model === 'slow'))
      .toBe(true)
    const cancelResult = await window.evaluate(async (id) => {
      const api = (globalThis as typeof globalThis & { waveYourYarn: WaveYourYarnApi }).waveYourYarn
      return api.llmJobs.cancel({ id })
    }, slowJobId)
    expect(cancelResult).toEqual({ success: true, data: true })
    const cancelled = await waitForJob(window, slowJobId)
    expect(cancelled).toMatchObject({ status: 'cancelled', errorCode: 'LLM_CANCELLED' })

    const history = await window.evaluate(async () => {
      const api = (globalThis as typeof globalThis & { waveYourYarn: WaveYourYarnApi }).waveYourYarn
      return api.aiReports.list()
    })
    expect(history.success).toBe(true)
    expect(history.data).toHaveLength(1)
    expect(mockProvider.requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ model: 'success', authorization: 'Bearer e2e-fake-api-key' }),
        expect.objectContaining({ model: 'invalid' }),
        expect.objectContaining({ model: 'auth' }),
        expect.objectContaining({ model: 'slow' })
      ])
    )
  } finally {
    await electronApp.close()
    await mockProvider.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
})

interface MockProviderRequest {
  model?: string
  authorization?: string
}

async function startMockProvider(): Promise<{
  baseUrl: string
  requests: MockProviderRequest[]
  close: () => Promise<void>
}> {
  const requests: MockProviderRequest[] = []
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { model?: string }
      requests.push({
        model: payload.model,
        authorization: request.headers.authorization
      })

      if (payload.model === 'auth') {
        response.writeHead(401, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: { message: 'unauthorized' } }))
        return
      }
      if (payload.model === 'slow') {
        const timer = setTimeout(() => sendChatCompletion(response, validMockReport()), 30_000)
        request.once('close', () => clearTimeout(timer))
        return
      }
      sendChatCompletion(response, payload.model === 'invalid' ? '{}' : validMockReport())
    })
  })
  await listen(server)
  const address = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    requests,
    close: () => closeServer(server)
  }
}

function sendChatCompletion(response: import('node:http').ServerResponse, content: string): void {
  if (response.destroyed) {
    return
  }
  response.writeHead(200, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ choices: [{ message: { content } }] }))
}

function validMockReport(): string {
  const evidence = { songIds: ['e2e-song-1'], factKeys: ['sample.songCount'] }
  const insight = {
    title: '样本观察',
    description: '这是一条基于有限收藏样本形成的克制观察。',
    confidence: 'low',
    evidence
  }
  return JSON.stringify({
    schemaVersion: 1,
    title: 'E2E 音乐报告',
    subtitle: '基于最近收藏样本的端到端验证',
    tasteSnapshot: {
      summary: '样本显示出稳定的艺术家偏好，同时仍保留有限的探索空间。',
      keywords: ['稳定', '探索'],
      evidence
    },
    listeningArchetype: {
      name: '克制探索者',
      description: '你可能在熟悉的声音与少量新鲜感之间保持平衡。',
      confidence: 'medium',
      evidence
    },
    dimensions: [
      'exploration_familiarity',
      'focus_variety',
      'collection_rhythm',
      'emotional_texture'
    ].map((key) => ({ ...insight, key, tendency: '低置信度倾向' })),
    moodsAndScenes: [insight],
    notablePatterns: [{ ...insight, confidence: 'high' }],
    personalityReflections: [insight],
    limitations: ['样本数量有限。', '不包含完整播放历史。']
  })
}

async function createMockProfile(window: Page, baseUrl: string): Promise<string> {
  const result = await window.evaluate(async (url) => {
    const api = (globalThis as typeof globalThis & { waveYourYarn: WaveYourYarnApi }).waveYourYarn
    const created = await api.llmProfiles.create({
      name: 'E2E mock provider',
      protocol: 'openai_chat_completions',
      baseUrl: url,
      modelId: 'success',
      timeoutMs: 10_000,
      outputMode: 'json_object',
      language: 'zh-CN',
      maxInputSongs: 100
    })
    if (!created.success || !created.data) {
      return created
    }
    const keyResult = await api.llmProfiles.setApiKey({
      id: created.data.id,
      apiKey: 'e2e-fake-api-key'
    })
    return keyResult.success ? { success: true, data: created.data.id } : keyResult
  }, baseUrl)
  expect(result.success).toBe(true)
  expect(result.data).toBeTruthy()
  return result.data as string
}

async function updateProfileModel(window: Page, id: string, modelId: string): Promise<void> {
  const result = await window.evaluate(
    async ({ profileId, nextModelId }) => {
      const api = (globalThis as typeof globalThis & { waveYourYarn: WaveYourYarnApi }).waveYourYarn
      return api.llmProfiles.update({
        id: profileId,
        changes: { modelId: nextModelId }
      })
    },
    { profileId: id, nextModelId: modelId }
  )
  expect(result.success, result.message).toBe(true)
}

async function startReport(window: Page, profileId: string): Promise<string> {
  const result = await window.evaluate(async (id) => {
    const api = (globalThis as typeof globalThis & { waveYourYarn: WaveYourYarnApi }).waveYourYarn
    const preview = await api.aiDisclosure.preview({
      profileId: id,
      source: { type: 'liked' },
      requestedSongLimit: 1,
      language: 'zh-CN'
    })
    if (!preview.success || !preview.data) {
      return preview
    }
    const authorization = await api.aiDisclosure.authorize({
      previewId: preview.data.previewId,
      confirmed: true,
      remember: false
    })
    if (!authorization.success || !authorization.data) {
      return authorization
    }
    return api.aiReports.start({
      profileId: id,
      source: { type: 'liked' },
      authorizationToken: authorization.data.token,
      requestedSongLimit: 1,
      language: 'zh-CN'
    })
  }, profileId)
  expect(result.success, result.message).toBe(true)
  expect(result.data).toMatchObject({ kind: 'ai_report_generation' })
  return (result.data as { id: string }).id
}

async function waitForJob(window: Page, id: string): Promise<Record<string, unknown>> {
  let latest: Awaited<ReturnType<WaveYourYarnApi['llmJobs']['get']>> | undefined
  await expect
    .poll(
      async () => {
        latest = await window.evaluate(async (jobId) => {
          const api = (globalThis as typeof globalThis & { waveYourYarn: WaveYourYarnApi })
            .waveYourYarn
          return api.llmJobs.get({ id: jobId })
        }, id)
        return latest.data?.status
      },
      { timeout: 10_000 }
    )
    .toMatch(/^(succeeded|failed|cancelled|interrupted)$/u)
  expect(latest?.success, latest?.message).toBe(true)
  return latest?.data as unknown as Record<string, unknown>
}

async function getReportByJob(window: Page, jobId: string) {
  return window.evaluate(async (id) => {
    const api = (globalThis as typeof globalThis & { waveYourYarn: WaveYourYarnApi }).waveYourYarn
    return api.aiReports.getByJob({ jobId: id })
  }, jobId)
}

async function seedLikedSong(
  electronApp: Awaited<ReturnType<typeof electron.launch>>
): Promise<void> {
  await electronApp.evaluate(async ({ app }) => {
    const { createRequire } = process.getBuiltinModule('node:module')
    const { join } = process.getBuiltinModule('node:path')
    const require = createRequire(join(app.getAppPath(), 'package.json'))
    const Database = require('better-sqlite3') as typeof import('better-sqlite3')
    const database = new Database(join(app.getPath('userData'), 'WaveYourYarn', 'waveyouryarn.db'))
    const now = new Date().toISOString()
    database
      .prepare(
        `INSERT INTO songs (
          id, ncm_song_id, name, artists_json, album, duration, cover_url,
          alias_json, raw_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?)`
      )
      .run(
        'song-row-1',
        'e2e-song-1',
        'E2E Song',
        '["E2E Artist"]',
        'E2E Album',
        180_000,
        '[]',
        now,
        now
      )
    database
      .prepare(
        `INSERT INTO playlists (
          id, ncm_playlist_id, name, description, cover_url, track_count, type,
          raw_data, created_at, updated_at
        ) VALUES (?, ?, ?, NULL, NULL, 1, 'liked', NULL, ?, ?)`
      )
      .run('liked-playlist-1', 'e2e-liked-1', '我喜欢的音乐', now, now)
    database
      .prepare(
        `INSERT INTO playlist_songs (
          id, playlist_id, song_id, order_index, created_at, added_at
        ) VALUES (?, ?, ?, 0, ?, ?)`
      )
      .run('liked-relation-1', 'liked-playlist-1', 'song-row-1', now, Date.now())
    database.close()
  })
}

function listen(server: Server): Promise<void> {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolveListen()
    })
  })
}

function closeServer(server: Server): Promise<void> {
  server.closeAllConnections()
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()))
  })
}
