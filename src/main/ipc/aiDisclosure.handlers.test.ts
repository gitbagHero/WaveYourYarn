import { describe, expect, it, vi } from 'vitest'
import type { AIDisclosureService } from '../services/AIDisclosureService'
import { AIDisclosureIpcHandlers } from './aiDisclosure.handlers'

describe('AIDisclosureIpcHandlers', () => {
  it('passes only strictly validated preview and authorization DTOs to main services', async () => {
    const service = {
      preview: vi.fn(async (request) => ({ previewId: 'preview-1', request })),
      authorize: vi.fn((request) => ({ token: 'token-1', request }))
    } as unknown as AIDisclosureService
    const handlers = new AIDisclosureIpcHandlers(service)

    await expect(
      handlers.preview({ profileId: 'profile-1', source: { type: 'liked' } })
    ).resolves.toMatchObject({
      success: true,
      data: { request: { profileId: 'profile-1', source: { type: 'liked' } } }
    })
    await expect(
      handlers.authorize({ previewId: 'preview-1', confirmed: true, remember: false })
    ).resolves.toMatchObject({
      success: true,
      data: {
        request: { previewId: 'preview-1', confirmed: true, remember: false }
      }
    })
    expect(service.preview).toHaveBeenCalledOnce()
    expect(service.authorize).toHaveBeenCalledOnce()

    await expect(
      handlers.preview({
        profileId: 'profile-1',
        source: { type: 'liked' },
        prompt: 'smuggled raw prompt'
      })
    ).resolves.toMatchObject({ success: false, error: 'LLM_PROFILE_INVALID' })
    expect(service.preview).toHaveBeenCalledOnce()
  })

  it('validates confirmation preferences and exposes revocation only as a count', async () => {
    const service = {
      getPreferences: vi.fn(() => ({
        confirmationMode: 'allow_remembered',
        rememberedConsentCount: 2
      })),
      setConfirmationMode: vi.fn(async (confirmationMode) => ({
        confirmationMode,
        rememberedConsentCount: 2
      })),
      revokeRememberedConsents: vi.fn(() => ({
        confirmationMode: 'allow_remembered',
        rememberedConsentCount: 0
      }))
    } as unknown as AIDisclosureService
    const handlers = new AIDisclosureIpcHandlers(service)

    await expect(handlers.getPreferences()).resolves.toMatchObject({
      success: true,
      data: { rememberedConsentCount: 2 }
    })
    await expect(handlers.setPreferences({ confirmationMode: 'always' })).resolves.toMatchObject({
      success: true,
      data: { confirmationMode: 'always' }
    })
    await expect(handlers.revokeRemembered()).resolves.toMatchObject({
      success: true,
      data: { rememberedConsentCount: 0 }
    })
    expect(JSON.stringify(await handlers.getPreferences())).not.toMatch(/dataset|song|token/i)
  })
})
