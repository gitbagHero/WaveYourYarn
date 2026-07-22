import type { AIDisclosureService } from '../services/AIDisclosureService'
import { AIDisclosureIpcHandlers } from './aiDisclosure.handlers'
import { registerIpcHandler } from './registerIpcHandler'

export function registerAIDisclosureIpc(service: AIDisclosureService): void {
  const handlers = new AIDisclosureIpcHandlers(service)

  registerIpcHandler('ai-disclosure:get-preferences', () => handlers.getPreferences())
  registerIpcHandler('ai-disclosure:set-preferences', (_event, payload: unknown) =>
    handlers.setPreferences(payload)
  )
  registerIpcHandler('ai-disclosure:revoke-remembered', () => handlers.revokeRemembered())
  registerIpcHandler('ai-disclosure:preview', (_event, payload: unknown) =>
    handlers.preview(payload)
  )
  registerIpcHandler('ai-disclosure:authorize', (_event, payload: unknown) =>
    handlers.authorize(payload)
  )
}
