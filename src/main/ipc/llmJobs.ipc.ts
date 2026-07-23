import {
  createDefaultLLMProviderRegistry,
  type LLMProviderRegistry
} from '../adapters/llm/LLMProviderRegistry'
import { JobRunRepository } from '../db/repositories/JobRunRepository'
import { LLMProfileRepository } from '../db/repositories/LLMProfileRepository'
import { JobManager } from '../services/JobManager'
import { LLMConnectionTestService } from '../services/LLMConnectionTestService'
import { LLMProfileService } from '../services/LLMProfileService'
import { AIDisclosureService } from '../services/AIDisclosureService'
import { AIDisclosureConsentRepository } from '../db/repositories/AIDisclosureConsentRepository'
import { AIReportRepository } from '../db/repositories/AIReportRepository'
import { AIReportSourceRepository } from '../db/repositories/AIReportSourceRepository'
import { StatisticsRepository } from '../db/repositories/StatisticsRepository'
import { getDatabase } from '../db/database'
import { StatisticsService } from '../services/StatisticsService'
import { AIReportGenerationService } from '../services/AIReportGenerationService'
import { AIReportService } from '../services/AIReportService'
import { LLMJobsIpcHandlers } from './llmJobs.handlers'
import { registerIpcHandler } from './registerIpcHandler'

export interface LLMIpcServices {
  profileService: LLMProfileService
  profileRepository: LLMProfileRepository
  jobRepository: JobRunRepository
  jobManager: JobManager
  disclosureService: AIDisclosureService
  providerRegistry: LLMProviderRegistry
  reportService: AIReportService
  reportGenerationService: AIReportGenerationService
}

export function createLLMIpcServices(): LLMIpcServices {
  const profileRepository = new LLMProfileRepository()
  const jobRepository = new JobRunRepository()
  const profileService = new LLMProfileService(profileRepository)
  const jobManager = new JobManager(jobRepository)
  const providerRegistry = createDefaultLLMProviderRegistry()
  const datasets = new StatisticsService(new StatisticsRepository(getDatabase()))
  const disclosureService = new AIDisclosureService(
    profileRepository,
    new AIDisclosureConsentRepository(),
    datasets
  )
  const reports = new AIReportRepository()
  const reportSources = new AIReportSourceRepository()
  return {
    profileService,
    profileRepository,
    jobRepository,
    jobManager,
    disclosureService,
    providerRegistry,
    reportService: new AIReportService(reports, reportSources),
    reportGenerationService: new AIReportGenerationService(
      profileService,
      disclosureService,
      datasets,
      jobManager,
      providerRegistry,
      reports,
      reportSources
    )
  }
}

export function registerLLMJobsIpc(services: LLMIpcServices): void {
  const connectionTests = new LLMConnectionTestService(
    services.profileService,
    services.profileRepository,
    services.jobRepository,
    services.jobManager,
    services.providerRegistry
  )
  const handlers = new LLMJobsIpcHandlers(
    services.jobRepository,
    services.jobManager,
    connectionTests
  )

  registerIpcHandler('llm-jobs:list', () => handlers.list())
  registerIpcHandler('llm-jobs:get', (_event, payload: unknown) => handlers.get(payload))
  registerIpcHandler('llm-jobs:cancel', (_event, payload: unknown) => handlers.cancel(payload))
  registerIpcHandler('llm-profiles:test-connection', (_event, payload: unknown) =>
    handlers.testConnection(payload)
  )
}
