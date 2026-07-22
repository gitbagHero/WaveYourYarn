import { createDefaultLLMProviderRegistry } from '../adapters/llm/LLMProviderRegistry'
import { JobRunRepository } from '../db/repositories/JobRunRepository'
import { LLMProfileRepository } from '../db/repositories/LLMProfileRepository'
import { JobManager } from '../services/JobManager'
import { LLMConnectionTestService } from '../services/LLMConnectionTestService'
import { LLMProfileService } from '../services/LLMProfileService'
import { AIDisclosureService } from '../services/AIDisclosureService'
import { LLMJobsIpcHandlers } from './llmJobs.handlers'
import { registerIpcHandler } from './registerIpcHandler'

export interface LLMIpcServices {
  profileService: LLMProfileService
  profileRepository: LLMProfileRepository
  jobRepository: JobRunRepository
  jobManager: JobManager
  disclosureService: AIDisclosureService
}

export function createLLMIpcServices(): LLMIpcServices {
  const profileRepository = new LLMProfileRepository()
  const jobRepository = new JobRunRepository()
  const profileService = new LLMProfileService(profileRepository)
  return {
    profileService,
    profileRepository,
    jobRepository,
    jobManager: new JobManager(jobRepository),
    disclosureService: new AIDisclosureService(profileRepository)
  }
}

export function registerLLMJobsIpc(services: LLMIpcServices): void {
  const connectionTests = new LLMConnectionTestService(
    services.profileService,
    services.profileRepository,
    services.jobRepository,
    services.jobManager,
    createDefaultLLMProviderRegistry()
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
