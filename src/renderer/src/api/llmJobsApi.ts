import { getPreloadApi } from './preloadClient'
import type { LLMJobIdRequest } from '../../../main/types/llm'

export const llmJobsApi = {
  list: () => getPreloadApi().llmJobs.list(),
  get: (request: LLMJobIdRequest) => getPreloadApi().llmJobs.get(request),
  cancel: (request: LLMJobIdRequest) => getPreloadApi().llmJobs.cancel(request)
}
