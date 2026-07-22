import type { IpcResult } from '../../../main/types/common'
import type {
  AIDisclosureAuthorization,
  AIDisclosurePreferences,
  AIDisclosurePreview,
  AIDisclosurePreviewRequest,
  AuthorizeAIDisclosureRequest
} from '../types/llm'
import { getPreloadApi } from './preloadClient'

export const aiDisclosureApi = {
  getPreferences: () => getPreloadApi().aiDisclosure.getPreferences(),
  setPreferences: (confirmationMode: AIDisclosurePreferences['confirmationMode']) =>
    getPreloadApi().aiDisclosure.setPreferences({ confirmationMode }),
  revokeRemembered: () => getPreloadApi().aiDisclosure.revokeRemembered(),
  preview: (request: AIDisclosurePreviewRequest) => getPreloadApi().aiDisclosure.preview(request),
  authorize: (request: AuthorizeAIDisclosureRequest) =>
    getPreloadApi().aiDisclosure.authorize(request)
} satisfies {
  getPreferences(): Promise<IpcResult<AIDisclosurePreferences>>
  setPreferences(
    confirmationMode: AIDisclosurePreferences['confirmationMode']
  ): Promise<IpcResult<AIDisclosurePreferences>>
  revokeRemembered(): Promise<IpcResult<AIDisclosurePreferences>>
  preview(request: AIDisclosurePreviewRequest): Promise<IpcResult<AIDisclosurePreview>>
  authorize(request: AuthorizeAIDisclosureRequest): Promise<IpcResult<AIDisclosureAuthorization>>
}
