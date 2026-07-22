import { LLMProfileService } from '../services/LLMProfileService'
import { LLMProfilesIpcHandlers } from './llmProfiles.handlers'
import { registerIpcHandler } from './registerIpcHandler'

export function registerLLMProfilesIpc(service = new LLMProfileService()): void {
  const handlers = new LLMProfilesIpcHandlers(service)

  registerIpcHandler('llm-profiles:list', () => handlers.list())
  registerIpcHandler('llm-profiles:get-active', () => handlers.getActive())
  registerIpcHandler('llm-profiles:get-protocol-options', () => handlers.getProtocolOptions())
  registerIpcHandler('llm-profiles:create', (_event, payload: unknown) => handlers.create(payload))
  registerIpcHandler('llm-profiles:update', (_event, payload: unknown) => handlers.update(payload))
  registerIpcHandler('llm-profiles:delete', (_event, payload: unknown) => handlers.delete(payload))
  registerIpcHandler('llm-profiles:set-active', (_event, payload: unknown) =>
    handlers.setActive(payload)
  )
  registerIpcHandler('llm-profiles:set-api-key', (_event, payload: unknown) =>
    handlers.setApiKey(payload)
  )
  registerIpcHandler('llm-profiles:delete-api-key', (_event, payload: unknown) =>
    handlers.deleteApiKey(payload)
  )
}
