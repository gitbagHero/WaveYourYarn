import type { AIReportFactsV1 } from '../../types/aiReport'
import type { MusicAnalysisDataset } from '../../types/statistics'

export const AI_REPORT_FACT_KEYS = [
  'sample.songCount',
  'artists.uniqueCount',
  'artists.topShare',
  'artists.singleAppearanceShare',
  'albums.uniqueCount',
  'collaborations.songShare',
  'collection.timestampCoverage',
  'collection.spanDays'
] as const

export function buildAIReportFacts(dataset: MusicAnalysisDataset): AIReportFactsV1 {
  const artistCounts = new Map<string, number>()
  const albumKeys = new Set<string>()
  let collaborationSongCount = 0

  for (const song of dataset.compactSongs) {
    const uniqueArtists = new Set(song.artists.map((artist) => artist.trim()).filter(Boolean))
    if (uniqueArtists.size > 1) {
      collaborationSongCount += 1
    }

    for (const artist of uniqueArtists) {
      artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1)
    }

    albumKeys.add(
      `${song.album?.trim() || '未知专辑'}\u0000${song.artists[0]?.trim() || '未知歌手'}`
    )
  }

  const songCount = dataset.compactSongs.length
  const timestamps = dataset.compactSongs
    .map((song) => song.time)
    .filter((time): time is number => typeof time === 'number')
  const topArtistCount = Math.max(0, ...artistCounts.values())
  const singleAppearanceArtistCount = [...artistCounts.values()].filter(
    (count) => count === 1
  ).length
  const earliestTime = timestamps.length > 0 ? Math.min(...timestamps) : undefined
  const latestTime = timestamps.length > 0 ? Math.max(...timestamps) : undefined

  return {
    schemaVersion: 1,
    sample: {
      songCount,
      requestedSongLimit: dataset.scope.requestedSongLimit,
      availableSongCount: dataset.scope.availableSongCount,
      selection: dataset.scope.selection,
      timePrecision: dataset.scope.timePrecision
    },
    artists: {
      uniqueCount: artistCounts.size,
      topShare: percentage(topArtistCount, songCount),
      singleAppearanceShare: percentage(singleAppearanceArtistCount, artistCounts.size),
      top: dataset.summary.topArtists.slice(0, 10).map(({ name, count, percentage }) => ({
        name,
        count,
        percentage
      }))
    },
    albums: {
      uniqueCount: albumKeys.size,
      top: dataset.summary.topAlbums
        .slice(0, 10)
        .map(({ name, artistNames, count, percentage }) => ({
          name,
          artistNames,
          count,
          percentage
        }))
    },
    collaborations: {
      songShare: percentage(collaborationSongCount, songCount)
    },
    collection: {
      timestampCoverage: percentage(timestamps.length, songCount),
      spanDays:
        earliestTime !== undefined && latestTime !== undefined
          ? Math.round(((latestTime - earliestTime) / 86_400_000) * 10) / 10
          : undefined,
      earliestTime,
      latestTime
    }
  }
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0
  }

  return Math.round((numerator / denominator) * 1_000) / 10
}
