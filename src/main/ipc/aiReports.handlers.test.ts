import { describe, expect, it, vi } from 'vitest'
import { AIReportServiceError } from '../services/AIReportService'
import type { AIReportDetail, AIReportSummary } from '../types/aiReport'
import type { JobRun } from '../types/llm'
import {
  AIReportsIpcHandlers,
  type AIReportGenerator,
  type AIReportReaderWriter
} from './aiReports.handlers'

describe('AIReportsIpcHandlers', () => {
  it('validates generation input without echoing the single-use authorization', async () => {
    const reports = reportServiceFixture()
    const start = vi.fn<AIReportGenerator['start']>(async (request) =>
      jobFixture(request.profileId)
    )
    const handlers = new AIReportsIpcHandlers(reports, { start })

    const result = await handlers.start({
      profileId: 'profile-1',
      source: { type: 'liked' },
      authorizationToken: 'single-use-secret'
    })

    expect(result).toMatchObject({ success: true, data: { id: 'job-1', status: 'pending' } })
    expect(start).toHaveBeenCalledWith({
      profileId: 'profile-1',
      source: { type: 'liked' },
      authorizationToken: 'single-use-secret'
    })
    expect(JSON.stringify(result)).not.toContain('single-use-secret')

    await expect(
      handlers.start({
        profileId: 'profile-1',
        source: { type: 'liked' },
        authorizationToken: 'single-use-secret',
        messages: [{ role: 'user', content: 'smuggled' }]
      })
    ).resolves.toMatchObject({ success: false, error: 'AI_REPORT_INVALID' })
  })

  it('exposes bounded history, detail, rename and soft-delete operations', async () => {
    const reports = reportServiceFixture()
    const handlers = new AIReportsIpcHandlers(reports, { start: async () => jobFixture() })

    await expect(handlers.list()).resolves.toMatchObject({
      success: true,
      data: [{ id: 'report-1', userTitle: 'Report' }]
    })
    await expect(handlers.get({ id: 'report-1' })).resolves.toMatchObject({ success: true })
    await expect(handlers.getByJob({ jobId: 'job-1' })).resolves.toMatchObject({ success: true })
    await expect(
      handlers.rename({ id: 'report-1', userTitle: ' Renamed ' })
    ).resolves.toMatchObject({ success: true })
    expect(reports.rename).toHaveBeenCalledWith('report-1', 'Renamed')
    await expect(handlers.delete({ id: 'report-1' })).resolves.toEqual({
      success: true,
      data: true
    })
  })

  it('maps deleted or missing reports to a stable renderer-safe error', async () => {
    const reports = reportServiceFixture()
    reports.get = () => {
      throw new AIReportServiceError('AI_REPORT_NOT_FOUND', 'AI 报告不存在或已删除')
    }
    const handlers = new AIReportsIpcHandlers(reports, { start: async () => jobFixture() })

    await expect(handlers.get({ id: 'missing' })).resolves.toEqual({
      success: false,
      error: 'AI_REPORT_NOT_FOUND',
      message: 'AI 报告不存在或已删除'
    })
  })
})

function reportServiceFixture(): AIReportReaderWriter & {
  rename: ReturnType<typeof vi.fn<AIReportReaderWriter['rename']>>
} {
  const summary: AIReportSummary = {
    id: 'report-1',
    jobId: 'job-1',
    profileId: 'profile-1',
    userTitle: 'Report',
    subtitle: 'Subtitle',
    keywords: ['one'],
    providerOrigin: 'https://llm.example.test',
    modelId: 'model-a',
    promptTemplateVersion: 3,
    datasetDigest: `sha256:${'a'.repeat(64)}`,
    generatedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
  const detail = { report: { id: summary.id }, sources: [] } as unknown as AIReportDetail
  const rename = vi.fn<AIReportReaderWriter['rename']>((id, userTitle) => {
    void id
    void userTitle
    return detail
  })
  return {
    list: () => [summary],
    get: () => detail,
    getByJobId: () => detail,
    rename,
    delete: () => true
  }
}

function jobFixture(profileId = 'profile-1'): JobRun {
  return {
    id: 'job-1',
    kind: 'ai_report_generation',
    profileId,
    status: 'pending',
    stage: 'queued',
    inputSummary: { sourceType: 'liked', songCount: 1 },
    createdAt: '2026-01-01T00:00:00.000Z'
  }
}
