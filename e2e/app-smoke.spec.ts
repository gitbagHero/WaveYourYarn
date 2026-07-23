import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { extractBackupArchive } from '../src/main/utils/backupFormat'

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
