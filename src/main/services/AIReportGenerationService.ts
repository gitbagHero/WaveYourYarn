import { nanoid } from 'nanoid'
import { LLMProviderError } from '../adapters/llm/LLMProvider'
import type { LLMProviderRegistry } from '../adapters/llm/LLMProviderRegistry'
import type { AIReportRepository } from '../db/repositories/AIReportRepository'
import type { AIReportSourceRepository } from '../db/repositories/AIReportSourceRepository'
import {
  AI_REPORT_CONTENT_SCHEMA_VERSION,
  type AIReportSourceRecord,
  type NewAIReportRecord,
  type StartAIReportGenerationRequest
} from '../types/aiReport'
import type { JobRun } from '../types/llm'
import type { MusicAnalysisDataset, StatisticsSource } from '../types/statistics'
import { nowIso } from '../utils/time'
import {
  AIDisclosureError,
  createAIDisclosureAuthorizationScope,
  type AIDisclosureDatasetProvider,
  type AIDisclosureService
} from './AIDisclosureService'
import type { JobManager } from './JobManager'
import type { LLMProfileService, RuntimeLLMProfile } from './LLMProfileService'
import { buildAIReportFacts } from './aiReport/reportFacts'
import { buildAIReportPrompt } from './aiReport/reportPrompt'
import { AIReportValidationError, parseAndValidateAIReport } from './aiReport/reportValidation'

const REPORT_MAX_OUTPUT_TOKENS = 5_000
const REPORT_PROGRESS_TOTAL = 4

interface GeneratedAIReportArtifacts {
  report: NewAIReportRecord
  source: AIReportSourceRecord
}

export class AIReportGenerationService {
  private readonly backgroundTasks = new Set<Promise<void>>()

  constructor(
    private readonly profiles: LLMProfileService,
    private readonly disclosure: AIDisclosureService,
    private readonly datasets: AIDisclosureDatasetProvider,
    private readonly jobs: JobManager,
    private readonly providers: LLMProviderRegistry,
    private readonly reports: AIReportRepository,
    private readonly sources: AIReportSourceRepository,
    private readonly createId: () => string = nanoid,
    private readonly clock: () => string = nowIso
  ) {}

  async start(request: StartAIReportGenerationRequest): Promise<JobRun> {
    const runtime = await this.profiles.getRuntimeProfile(request.profileId)
    const source = toStatisticsSource(request.source)
    const dataset = await this.datasets.getAnalysisDataset(source, runtime.profile.maxInputSongs)
    if (dataset.scope.includedSongCount === 0) {
      throw new AIDisclosureError('AI_DATASET_EMPTY', '当前来源没有可用于分析的歌曲')
    }

    const authorizationScope = createAIDisclosureAuthorizationScope(runtime.profile, dataset)
    this.disclosure.consumeAuthorization(request.authorizationToken, authorizationScope)

    const jobInput = {
      profileId: runtime.profile.id,
      inputSummary: {
        sourceType: authorizationScope.sourceType,
        ...(authorizationScope.sourceId ? { sourceId: authorizationScope.sourceId } : {}),
        songCount: authorizationScope.songCount,
        maximumSongCount: authorizationScope.maximumSongCount,
        fieldsHash: authorizationScope.fieldsHash,
        datasetDigest: authorizationScope.datasetDigest,
        language: runtime.profile.language
      }
    }
    const job = request.retryOfJobId
      ? this.jobs.retry(request.retryOfJobId, {
          expectedKind: 'ai_report_generation',
          ...jobInput
        })
      : this.jobs.createJob('ai_report_generation', jobInput)
    this.startInBackground(job, runtime, dataset, authorizationScope.targetOrigin)
    return job
  }

  private startInBackground(
    job: JobRun,
    runtime: RuntimeLLMProfile,
    dataset: MusicAnalysisDataset,
    providerOrigin: string
  ): void {
    const task = this.jobs
      .run(
        job.id,
        ({ signal, updateProgress }) =>
          this.generateArtifacts(job, runtime, dataset, providerOrigin, signal, updateProgress),
        ({ report, source }) => {
          this.reports.create(report)
          this.sources.create(source)
        }
      )
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        this.backgroundTasks.delete(task)
      })

    this.backgroundTasks.add(task)
  }

  private async generateArtifacts(
    job: JobRun,
    runtime: RuntimeLLMProfile,
    dataset: MusicAnalysisDataset,
    providerOrigin: string,
    signal: AbortSignal,
    updateProgress: (stage: string, current: number, total: number) => boolean
  ): Promise<GeneratedAIReportArtifacts> {
    updateProgress('building_prompt', 0, REPORT_PROGRESS_TOTAL)
    const facts = buildAIReportFacts(dataset)
    const prompt = buildAIReportPrompt(dataset, facts, runtime.profile.language)
    const provider = this.providers.createFromRuntimeProfile(runtime)

    updateProgress('requesting', 1, REPORT_PROGRESS_TOTAL)
    const rawContent = await provider.createChatCompletion({
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      maxTokens: REPORT_MAX_OUTPUT_TOKENS,
      ...(runtime.profile.outputMode === 'json_object'
        ? { responseFormat: 'json_object' as const }
        : {}),
      signal
    })

    updateProgress('validating', 2, REPORT_PROGRESS_TOTAL)
    let content: NewAIReportRecord['content']
    try {
      content = parseAndValidateAIReport(rawContent, dataset)
    } catch (error) {
      if (error instanceof AIReportValidationError) {
        throw new LLMProviderError('LLM_OUTPUT_INVALID', '模型返回的报告格式不符合要求。')
      }
      throw error
    }

    updateProgress('persisting', 3, REPORT_PROGRESS_TOTAL)
    const generatedAt = this.clock()
    const reportId = this.createId()
    return {
      report: {
        id: reportId,
        jobId: job.id,
        profileId: runtime.profile.id,
        userTitle: content.title,
        status: 'succeeded',
        contentSchemaVersion: AI_REPORT_CONTENT_SCHEMA_VERSION,
        protocol: runtime.profile.protocol,
        providerOrigin,
        modelId: runtime.profile.modelId,
        promptTemplateVersion: prompt.templateVersion,
        datasetDigest: dataset.digest,
        content,
        generatedAt,
        createdAt: generatedAt,
        updatedAt: generatedAt
      },
      source: {
        id: this.createId(),
        reportId,
        sourceType: dataset.source.type,
        sourceId: dataset.source.id,
        sourceName: dataset.source.name,
        datasetSchemaVersion: dataset.schemaVersion,
        selection: dataset.scope.selection,
        requestedSongLimit: dataset.scope.requestedSongLimit,
        availableSongCount: dataset.scope.availableSongCount,
        includedSongCount: dataset.scope.includedSongCount,
        truncated: dataset.scope.truncated,
        timePrecision: dataset.scope.timePrecision,
        songIds: dataset.compactSongs.map(({ ncmSongId }) => ncmSongId),
        summary: dataset.summary,
        datasetDigest: dataset.digest,
        generatedAt: dataset.generatedAt
      }
    }
  }
}

function toStatisticsSource(source: StartAIReportGenerationRequest['source']): StatisticsSource {
  if (source.type === 'liked' || source.type === 'all') {
    return { type: source.type }
  }
  if (!source.playlistId?.trim()) {
    throw new AIDisclosureError('AI_DISCLOSURE_SCOPE_CHANGED', '歌单来源缺少有效 ID，请重新预览')
  }
  return { type: 'playlist', playlistId: source.playlistId.trim() }
}
