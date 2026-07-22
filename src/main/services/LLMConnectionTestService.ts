import { LLMProviderRegistry } from '../adapters/llm/LLMProviderRegistry'
import { LLMProfileRepository } from '../db/repositories/LLMProfileRepository'
import { JobRunRepository } from '../db/repositories/JobRunRepository'
import type { JobRun } from '../types/llm'
import { nowIso } from '../utils/time'
import { JobExecutionError, JobManager } from './JobManager'
import { LLMProfileService, type RuntimeLLMProfile } from './LLMProfileService'

const CONNECTION_TEST_MESSAGES = [
  {
    role: 'system' as const,
    content: 'This is a connection test. Do not use tools. Reply with exactly OK.'
  },
  { role: 'user' as const, content: 'ping' }
]

export class LLMConnectionTestService {
  private readonly backgroundTasks = new Set<Promise<void>>()

  constructor(
    private readonly profiles: LLMProfileService,
    private readonly profileRepository: LLMProfileRepository,
    private readonly jobRepository: JobRunRepository,
    private readonly jobs: JobManager,
    private readonly providers: LLMProviderRegistry,
    private readonly clock: () => string = nowIso
  ) {}

  async start(profileId: string): Promise<JobRun> {
    const runtime = await this.profiles.getRuntimeProfile(profileId)
    const existing = this.jobRepository.findUnfinishedForProfile(profileId, 'llm_connection_test')
    if (existing) {
      return existing
    }
    const job = this.jobs.createJob('llm_connection_test', {
      profileId,
      inputSummary: { sendsMusicData: false }
    })
    this.startInBackground(job, runtime)
    return job
  }

  private startInBackground(job: JobRun, runtime: RuntimeLLMProfile): void {
    const task = this.jobs
      .run(job.id, async ({ signal, updateProgress }) => {
        updateProgress('connecting', 0, 1)
        const provider = this.providers.createFromRuntimeProfile(runtime)
        await provider.createChatCompletion({
          messages: CONNECTION_TEST_MESSAGES,
          maxTokens: 16,
          signal
        })
        updateProgress('validating', 1, 1)
      })
      .then(() => {
        this.profileRepository.updateConnectionTest(runtime.profile.id, 'succeeded', this.clock())
      })
      .catch((error: unknown) => {
        if (!(error instanceof JobExecutionError && error.code === 'LLM_CANCELLED')) {
          this.profileRepository.updateConnectionTest(runtime.profile.id, 'failed', this.clock())
        }
      })
      .finally(() => {
        this.backgroundTasks.delete(task)
      })

    this.backgroundTasks.add(task)
  }
}
