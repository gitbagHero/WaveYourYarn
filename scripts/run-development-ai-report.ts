import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type Database from 'better-sqlite3'
import { loadEnv } from 'vite'
import {
  LLMProviderError,
  OpenAICompatibleProvider
} from '../src/main/adapters/llm/OpenAICompatibleProvider'
import {
  DevelopmentLLMConfigError,
  readDevelopmentLLMConfig
} from '../src/main/config/developmentLlmConfig'
import { StatisticsRepository } from '../src/main/db/repositories/StatisticsRepository'
import { StatisticsService } from '../src/main/services/StatisticsService'
import { buildAIReportFacts } from '../src/main/services/aiReport/reportFacts'
import { buildAIReportPrompt } from '../src/main/services/aiReport/reportPrompt'
import { parseAndValidateAIReport } from '../src/main/services/aiReport/reportValidation'

await run().catch((error: unknown) => {
  if (error instanceof LLMProviderError || error instanceof DevelopmentLLMConfigError) {
    console.error('Development AI report smoke test failed.', {
      code: error.code,
      message: error.message,
      ...('status' in error && error.status ? { status: error.status } : {})
    })
  } else {
    console.error('Development AI report smoke test failed.', {
      code: 'DEV_LLM_REPORT_FAILED',
      message: error instanceof Error ? error.message : 'Unknown development error.'
    })
  }
  process.exitCode = 1
})

async function run(): Promise<void> {
  const projectRoot = resolve(import.meta.dirname, '..')
  const loadedEnvironment = loadEnv('development', projectRoot, 'WYY_DEV_LLM_')
  const environment = { ...loadedEnvironment, ...process.env }
  const config = readDevelopmentLLMConfig({ isPackaged: false, env: environment })
  const databasePath = environment.WYY_DEV_LLM_DATABASE_PATH?.trim() || defaultDatabasePath()
  const sqlite = new DatabaseSync(databasePath, { readOnly: true })

  try {
    const repository = new StatisticsRepository(sqlite as unknown as Database.Database)
    const statisticsService = new StatisticsService(repository)
    const dataset = await statisticsService.getAnalysisDataset({ type: 'liked' })

    if (dataset.scope.includedSongCount === 0) {
      throw new Error('最近收藏样本为空，请先在应用中同步“我喜欢的音乐”。')
    }
    if (dataset.scope.includedSongCount > 100) {
      throw new Error('开发报告输入超过 100 首安全上限。')
    }

    const facts = buildAIReportFacts(dataset)
    const prompt = buildAIReportPrompt(dataset, facts)

    if (process.argv.includes('--dry-run')) {
      console.info('Development AI report dry run succeeded.', {
        songCount: dataset.scope.includedSongCount,
        availableSongCount: dataset.scope.availableSongCount,
        datasetDigest: dataset.digest,
        promptCharacters: prompt.system.length + prompt.user.length
      })
      return
    }

    const provider = new OpenAICompatibleProvider(config)
    const rawReport = await provider.createChatCompletion({
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      maxTokens: 5_000,
      reasoningEffort: 'low',
      responseFormat: 'json_object'
    })
    const report = parseAndValidateAIReport(rawReport, dataset)
    const outputDirectory = join(dirname(databasePath), 'development')
    const outputPath = join(outputDirectory, 'ai-report-smoke-latest.json')
    await mkdir(outputDirectory, { recursive: true, mode: 0o700 })
    await writeFile(
      outputPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          dataset: { digest: dataset.digest, scope: dataset.scope },
          report
        },
        null,
        2
      )}\n`,
      { encoding: 'utf8', mode: 0o600 }
    )

    console.info('Development AI report smoke test succeeded.', {
      songCount: dataset.scope.includedSongCount,
      datasetDigest: dataset.digest,
      outputPath
    })
  } finally {
    sqlite.close()
  }
}

function defaultDatabasePath(): string {
  if (process.platform === 'darwin') {
    return join(
      homedir(),
      'Library',
      'Application Support',
      'waveyouryarn',
      'WaveYourYarn',
      'waveyouryarn.db'
    )
  }

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA
    if (!appData) {
      throw new Error('APPDATA is unavailable; set WYY_DEV_LLM_DATABASE_PATH explicitly.')
    }
    return join(appData, 'waveyouryarn', 'WaveYourYarn', 'waveyouryarn.db')
  }

  throw new Error('Set WYY_DEV_LLM_DATABASE_PATH for this development platform.')
}
