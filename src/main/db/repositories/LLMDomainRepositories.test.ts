import { afterEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDatabase } from '../testing/createTestDatabase'
import type { AIDisclosureConsent, JobRun, LLMProfileRecord } from '../../types/llm'
import { AIDisclosureConsentRepository } from './AIDisclosureConsentRepository'
import { JobRunRepository } from './JobRunRepository'
import { LLMProfileRepository } from './LLMProfileRepository'

describe('LLM domain repositories', () => {
  const databases: Database.Database[] = []

  afterEach(() => {
    for (const db of databases.splice(0)) {
      db.close()
    }
  })

  it('stores profiles, enforces one active profile and promotes a replacement on delete', () => {
    const db = createTestDatabase()
    databases.push(db)
    const repository = new LLMProfileRepository(db)
    const primary = profileFixture('profile-1', true, '2026-01-01T00:00:00.000Z')
    const secondary = profileFixture('profile-2', false, '2026-01-02T00:00:00.000Z')

    repository.create(primary)
    repository.create(secondary)
    expect(repository.count()).toBe(2)
    expect(repository.findActive()?.id).toBe(primary.id)
    expect(repository.findAll().map(({ id }) => id)).toEqual([primary.id, secondary.id])

    expect(repository.setActive(secondary.id, '2026-01-03T00:00:00.000Z')).toBe(true)
    expect(repository.findActive()?.id).toBe(secondary.id)
    expect(
      repository.updateConnectionTest(secondary.id, 'succeeded', '2026-01-04T00:00:00.000Z')
    ).toBe(true)
    expect(repository.findById(secondary.id)).toMatchObject({
      lastTestStatus: 'succeeded',
      lastTestedAt: '2026-01-04T00:00:00.000Z'
    })

    const updated = {
      ...repository.findById(secondary.id)!,
      name: 'Updated profile',
      modelId: 'updated-model',
      updatedAt: '2026-01-05T00:00:00.000Z'
    }
    expect(repository.update(updated)).toBe(true)
    expect(repository.findById(secondary.id)).toMatchObject({
      name: 'Updated profile',
      modelId: 'updated-model'
    })

    expect(repository.deleteById(secondary.id, '2026-01-06T00:00:00.000Z')).toBe(true)
    expect(repository.findActive()?.id).toBe(primary.id)
    expect(repository.deleteById('missing', '2026-01-07T00:00:00.000Z')).toBe(false)
  })

  it('applies atomic job transitions so cancellation cannot later become success', () => {
    const db = createTestDatabase()
    databases.push(db)
    const profiles = new LLMProfileRepository(db)
    const jobs = new JobRunRepository(db)
    profiles.create(profileFixture('profile-1', true, '2026-01-01T00:00:00.000Z'))
    jobs.create(jobFixture('job-1'))

    expect(jobs.markRunning('job-1', 'requesting', '2026-01-01T00:00:01.000Z')).toBe(true)
    expect(jobs.updateProgress('job-1', 'requesting', 1, 2)).toBe(true)
    expect(jobs.markCancelled('job-1', '2026-01-01T00:00:02.000Z')).toBe(true)
    expect(jobs.markSucceeded('job-1', '2026-01-01T00:00:03.000Z')).toBe(false)
    expect(jobs.findById('job-1')).toMatchObject({
      status: 'cancelled',
      progressCurrent: 1,
      progressTotal: 2,
      errorCode: 'LLM_CANCELLED'
    })

    jobs.create(jobFixture('job-2'))
    expect(jobs.markRunning('job-2', 'requesting', '2026-01-01T00:00:04.000Z')).toBe(true)
    jobs.create(jobFixture('job-3'))
    expect(jobs.interruptUnfinished('2026-01-01T00:00:05.000Z')).toBe(2)
    expect(jobs.findById('job-2')).toMatchObject({
      status: 'interrupted',
      errorCode: 'JOB_INTERRUPTED'
    })
    expect(jobs.findById('job-3')).toMatchObject({
      status: 'interrupted',
      errorCode: 'JOB_INTERRUPTED'
    })
  })

  it('matches remembered disclosure only within the same bounded scope', () => {
    const db = createTestDatabase()
    databases.push(db)
    const profiles = new LLMProfileRepository(db)
    const consents = new AIDisclosureConsentRepository(db)
    profiles.create(profileFixture('profile-1', true, '2026-01-01T00:00:00.000Z'))
    const consent: AIDisclosureConsent = {
      id: 'consent-1',
      profileId: 'profile-1',
      targetOrigin: 'https://llm.example.test',
      protocol: 'openai_chat_completions',
      sourceType: 'liked',
      fieldsHash: 'sha256:fields',
      maxInputSongs: 100,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
    consents.create(consent)

    expect(
      consents.findMatching({
        profileId: consent.profileId,
        targetOrigin: consent.targetOrigin,
        protocol: consent.protocol,
        sourceType: consent.sourceType,
        fieldsHash: consent.fieldsHash,
        maxInputSongs: 80
      })
    ).toEqual(consent)
    expect(
      consents.findMatching({
        profileId: consent.profileId,
        targetOrigin: consent.targetOrigin,
        protocol: consent.protocol,
        sourceType: consent.sourceType,
        fieldsHash: 'sha256:expanded-fields',
        maxInputSongs: 80
      })
    ).toBeNull()
    expect(
      consents.findMatching({
        profileId: consent.profileId,
        targetOrigin: consent.targetOrigin,
        protocol: consent.protocol,
        sourceType: consent.sourceType,
        fieldsHash: consent.fieldsHash,
        maxInputSongs: 101
      })
    ).toBeNull()

    expect(consents.deleteAll()).toBe(1)
  })
})

function profileFixture(id: string, isActive: boolean, updatedAt: string): LLMProfileRecord {
  return {
    id,
    name: id,
    protocol: 'openai_chat_completions',
    baseUrl: 'https://llm.example.test/v1/',
    modelId: 'test-model',
    timeoutMs: 60_000,
    outputMode: 'json_object',
    language: 'zh-CN',
    maxInputSongs: 100,
    secretRef: `llm-profile:${id}:api-key`,
    isActive,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt
  }
}

function jobFixture(id: string): JobRun {
  return {
    id,
    kind: 'llm_connection_test',
    profileId: 'profile-1',
    status: 'pending',
    stage: 'queued',
    inputSummary: { sendsMusicData: false },
    createdAt: '2026-01-01T00:00:00.000Z'
  }
}
