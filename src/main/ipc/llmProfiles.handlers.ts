import { LLM_PROTOCOL_CAPABILITIES, type LLMProtocolOption } from '../types/llm'
import type { LLMProfileService } from '../services/LLMProfileService'
import { toLLMIpcResult } from './llmIpcResult'
import {
  parseCreateLLMProfileRequest,
  parseLLMProfileIdRequest,
  parseSetLLMProfileApiKeyRequest,
  parseUpdateLLMProfileRequest
} from './llmValidators'

export class LLMProfilesIpcHandlers {
  constructor(private readonly service: LLMProfileService) {}

  list() {
    return toLLMIpcResult(() => this.service.list())
  }

  getActive() {
    return toLLMIpcResult(() => this.service.getActive())
  }

  getProtocolOptions() {
    const options: LLMProtocolOption[] = [
      {
        protocol: 'openai_chat_completions',
        label: 'OpenAI-compatible Chat Completions',
        outputModes: LLM_PROTOCOL_CAPABILITIES.openai_chat_completions.outputModes
      }
    ]
    return toLLMIpcResult(() => options)
  }

  create(payload: unknown) {
    return toLLMIpcResult(() => this.service.create(parseCreateLLMProfileRequest(payload)))
  }

  update(payload: unknown) {
    return toLLMIpcResult(() => {
      const request = parseUpdateLLMProfileRequest(payload)
      return this.service.update(request.id, request.changes)
    })
  }

  delete(payload: unknown) {
    return toLLMIpcResult(() => this.service.delete(parseLLMProfileIdRequest(payload).id))
  }

  setActive(payload: unknown) {
    return toLLMIpcResult(() => this.service.setActive(parseLLMProfileIdRequest(payload).id))
  }

  setApiKey(payload: unknown) {
    return toLLMIpcResult(() => {
      const request = parseSetLLMProfileApiKeyRequest(payload)
      return this.service.setApiKey(request.id, request.apiKey)
    })
  }

  deleteApiKey(payload: unknown) {
    return toLLMIpcResult(() => this.service.deleteApiKey(parseLLMProfileIdRequest(payload).id))
  }
}
