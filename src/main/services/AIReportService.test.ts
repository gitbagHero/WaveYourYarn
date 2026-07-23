import { describe, expect, it } from 'vitest'
import type { AIReportRecord, AIReportSourceRecord } from '../types/aiReport'
import { AIReportService, type AIReportSourceStore, type AIReportStore } from './AIReportService'

describe('AIReportService', () => {
  it('returns offline-safe summaries/details and applies rename plus soft delete', () => {
    const report = reportFixture()
    let deleted = false
    const reports: AIReportStore = {
      findAll: () => (deleted ? [] : [report]),
      findById: (id) => (!deleted && id === report.id ? report : null),
      findByJobId: (jobId) => (!deleted && jobId === report.jobId ? report : null),
      rename: (id, userTitle, updatedAt) => {
        if (deleted || id !== report.id) return false
        report.userTitle = userTitle
        report.updatedAt = updatedAt
        return true
      },
      softDelete: (id) => {
        if (deleted || id !== report.id) return false
        deleted = true
        return true
      }
    }
    const source = { id: 'source-1', reportId: report.id } as AIReportSourceRecord
    const sources: AIReportSourceStore = {
      findByReportId: (reportId) => (reportId === report.id ? [source] : [])
    }
    const service = new AIReportService(reports, sources, () => '2026-01-02T00:00:00.000Z')

    expect(service.list()).toEqual([
      expect.objectContaining({
        id: 'report-1',
        userTitle: 'Report',
        subtitle: 'Subtitle',
        keywords: ['one', 'two']
      })
    ])
    expect(service.getByJobId('job-1').sources).toEqual([source])
    expect(service.rename('report-1', 'Renamed').report).toMatchObject({
      userTitle: 'Renamed',
      updatedAt: '2026-01-02T00:00:00.000Z'
    })
    expect(service.delete('report-1')).toBe(true)
    expect(service.list()).toEqual([])
    expect(() => service.get('report-1')).toThrowError(
      expect.objectContaining({ code: 'AI_REPORT_NOT_FOUND' })
    )
  })
})

function reportFixture(): AIReportRecord {
  return {
    id: 'report-1',
    jobId: 'job-1',
    profileId: 'profile-1',
    userTitle: 'Report',
    status: 'succeeded',
    contentSchemaVersion: 1,
    protocol: 'openai_chat_completions',
    providerOrigin: 'https://llm.example.test',
    modelId: 'model-a',
    promptTemplateVersion: 3,
    datasetDigest: `sha256:${'a'.repeat(64)}`,
    content: {
      schemaVersion: 1,
      title: 'Report',
      subtitle: 'Subtitle',
      tasteSnapshot: {
        summary: 'Summary',
        keywords: ['one', 'two'],
        evidence: { songIds: [], factKeys: ['sample.songCount'] }
      },
      listeningArchetype: {
        name: 'Archetype',
        description: 'Description',
        confidence: 'low',
        evidence: { songIds: [], factKeys: [] }
      },
      dimensions: [],
      moodsAndScenes: [],
      notablePatterns: [],
      personalityReflections: [],
      limitations: []
    },
    generatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}
