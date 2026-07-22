import type { AIDisclosureService } from '../services/AIDisclosureService'
import { toLLMIpcResult } from './llmIpcResult'
import {
  parseAIDisclosureConfirmationMode,
  parseAIDisclosurePreviewRequest,
  parseAuthorizeAIDisclosureRequest
} from './llmValidators'

export class AIDisclosureIpcHandlers {
  constructor(private readonly service: AIDisclosureService) {}

  getPreferences() {
    return toLLMIpcResult(() => this.service.getPreferences())
  }

  setPreferences(payload: unknown) {
    return toLLMIpcResult(() =>
      this.service.setConfirmationMode(parseAIDisclosureConfirmationMode(payload))
    )
  }

  revokeRemembered() {
    return toLLMIpcResult(() => this.service.revokeRememberedConsents())
  }

  preview(payload: unknown) {
    return toLLMIpcResult(() => this.service.preview(parseAIDisclosurePreviewRequest(payload)))
  }

  authorize(payload: unknown) {
    return toLLMIpcResult(() => this.service.authorize(parseAuthorizeAIDisclosureRequest(payload)))
  }
}
