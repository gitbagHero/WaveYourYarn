import { getPreloadApi } from './preloadClient'
import type {
  CreateLLMProfileRequest,
  LLMProfileIdRequest,
  SetLLMProfileApiKeyRequest,
  UpdateLLMProfileRequest
} from '../../../main/types/llm'

export const llmProfilesApi = {
  list: () => getPreloadApi().llmProfiles.list(),
  getActive: () => getPreloadApi().llmProfiles.getActive(),
  getProtocolOptions: () => getPreloadApi().llmProfiles.getProtocolOptions(),
  create: (request: CreateLLMProfileRequest) => getPreloadApi().llmProfiles.create(request),
  update: (request: UpdateLLMProfileRequest) => getPreloadApi().llmProfiles.update(request),
  delete: (request: LLMProfileIdRequest) => getPreloadApi().llmProfiles.delete(request),
  setActive: (request: LLMProfileIdRequest) => getPreloadApi().llmProfiles.setActive(request),
  setApiKey: (request: SetLLMProfileApiKeyRequest) =>
    getPreloadApi().llmProfiles.setApiKey(request),
  deleteApiKey: (request: LLMProfileIdRequest) => getPreloadApi().llmProfiles.deleteApiKey(request),
  testConnection: (request: LLMProfileIdRequest) =>
    getPreloadApi().llmProfiles.testConnection(request)
}
