import { createHash } from 'node:crypto'
import type {
  CompactSongForAnalysis,
  MusicAnalysisScope,
  StatisticsSourceInfo
} from '../../types/statistics'

interface AnalysisDatasetDigestInput {
  schemaVersion: 1
  source: StatisticsSourceInfo
  scope: MusicAnalysisScope
  compactSongs: CompactSongForAnalysis[]
}

export function createAnalysisDatasetDigest(input: AnalysisDatasetDigestInput): string {
  const canonicalPayload = {
    schemaVersion: input.schemaVersion,
    source: {
      type: input.source.type,
      id: input.source.id ?? null,
      name: input.source.name,
      timeField: input.source.timeField
    },
    scope: input.scope,
    compactSongs: input.compactSongs.map((song) => ({
      ncmSongId: song.ncmSongId,
      name: song.name,
      artists: song.artists,
      album: song.album ?? null,
      time: song.time ?? null,
      orderIndex: song.orderIndex ?? null
    }))
  }

  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex')}`
}
