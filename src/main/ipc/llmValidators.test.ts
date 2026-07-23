import { describe, expect, it } from 'vitest'
import {
  parseAIDisclosureConfirmationMode,
  parseAIDisclosurePreviewRequest,
  parseAIReportIdRequest,
  parseAIReportJobIdRequest,
  parseAuthorizeAIDisclosureRequest,
  parseCreateLLMProfileRequest,
  parseLLMProfileIdRequest,
  parseRenameAIReportRequest,
  parseSetLLMProfileApiKeyRequest,
  parseStartAIReportGenerationRequest,
  parseUpdateLLMProfileRequest
} from './llmValidators'

const validProfile = {
  name: 'My model',
  protocol: 'openai_chat_completions',
  baseUrl: 'https://llm.example.test/v1',
  modelId: 'model-a',
  timeoutMs: 180_000,
  outputMode: 'json_object',
  language: 'zh-CN',
  maxInputSongs: 100
} as const

describe('LLM IPC validators', () => {
  it('accepts and normalizes the exact create contract', () => {
    expect(parseCreateLLMProfileRequest({ ...validProfile, name: ' My model ' })).toEqual(
      validProfile
    )
  })

  it.each([
    { ...validProfile, apiKey: 'must-use-separate-channel' },
    { ...validProfile, headers: { Authorization: 'Bearer secret' } },
    { ...validProfile, prompt: 'raw prompt' },
    { ...validProfile, timeoutMs: '180000' },
    { ...validProfile, protocol: 'custom_script' }
  ])('rejects extra or malformed create fields', (value) => {
    expect(() => parseCreateLLMProfileRequest(value)).toThrowError(
      expect.objectContaining({ code: 'LLM_PROFILE_INVALID' })
    )
  })

  it('accepts a non-empty partial update and rejects extra nested fields', () => {
    expect(parseUpdateLLMProfileRequest({ id: 'profile-1', changes: { name: 'Updated' } })).toEqual(
      { id: 'profile-1', changes: { name: 'Updated' } }
    )
    expect(() =>
      parseUpdateLLMProfileRequest({ id: 'profile-1', changes: { apiKey: 'secret' } })
    ).toThrowError(expect.objectContaining({ code: 'LLM_PROFILE_INVALID' }))
    expect(() => parseUpdateLLMProfileRequest({ id: 'profile-1', changes: {} })).toThrow()
  })

  it('keeps API Key isolated to its dedicated request', () => {
    expect(parseLLMProfileIdRequest({ id: ' profile-1 ' })).toEqual({ id: 'profile-1' })
    expect(parseSetLLMProfileApiKeyRequest({ id: 'profile-1', apiKey: ' key-value ' })).toEqual({
      id: 'profile-1',
      apiKey: 'key-value'
    })
    expect(() =>
      parseSetLLMProfileApiKeyRequest({ id: 'profile-1', apiKey: 'key', modelId: 'injected' })
    ).toThrow()
  })

  it('strictly validates disclosure sources, confirmation and preference requests', () => {
    expect(
      parseAIDisclosurePreviewRequest({
        profileId: 'profile-1',
        source: { type: 'playlist', playlistId: 'playlist-1' }
      })
    ).toEqual({
      profileId: 'profile-1',
      source: { type: 'playlist', playlistId: 'playlist-1' }
    })
    expect(() =>
      parseAIDisclosurePreviewRequest({
        profileId: 'profile-1',
        source: { type: 'liked', playlistId: 'smuggled' }
      })
    ).toThrow()
    expect(
      parseAuthorizeAIDisclosureRequest({
        previewId: 'preview-1',
        confirmed: true,
        remember: false
      })
    ).toEqual({ previewId: 'preview-1', confirmed: true, remember: false })
    expect(() =>
      parseAuthorizeAIDisclosureRequest({
        previewId: 'preview-1',
        confirmed: 'true',
        remember: false
      })
    ).toThrowError(expect.objectContaining({ code: 'AI_DISCLOSURE_INVALID' }))
    expect(parseAIDisclosureConfirmationMode({ confirmationMode: 'always' })).toBe('always')
    expect(() => parseAIDisclosureConfirmationMode({ confirmationMode: 'sometimes' })).toThrow()
  })

  it('accepts only bounded report generation and report artifact requests', () => {
    expect(
      parseStartAIReportGenerationRequest({
        profileId: 'profile-1',
        source: { type: 'playlist', playlistId: 'playlist-1' },
        authorizationToken: 'authorization-1',
        requestedSongLimit: 50,
        language: 'en-US',
        retryOfJobId: 'job-1'
      })
    ).toEqual({
      profileId: 'profile-1',
      source: { type: 'playlist', playlistId: 'playlist-1' },
      authorizationToken: 'authorization-1',
      requestedSongLimit: 50,
      language: 'en-US',
      retryOfJobId: 'job-1'
    })
    expect(parseAIReportIdRequest({ id: ' report-1 ' })).toEqual({ id: 'report-1' })
    expect(parseAIReportJobIdRequest({ jobId: ' job-1 ' })).toEqual({ jobId: 'job-1' })
    expect(parseRenameAIReportRequest({ id: 'report-1', userTitle: ' 新标题 ' })).toEqual({
      id: 'report-1',
      userTitle: '新标题'
    })
    expect(() =>
      parseStartAIReportGenerationRequest({
        profileId: 'profile-1',
        source: { type: 'liked' },
        authorizationToken: 'authorization-1',
        prompt: 'smuggled prompt'
      })
    ).toThrowError(expect.objectContaining({ code: 'AI_REPORT_INVALID' }))
    expect(() =>
      parseRenameAIReportRequest({ id: 'report-1', userTitle: '', content: {} })
    ).toThrow()
  })
})
