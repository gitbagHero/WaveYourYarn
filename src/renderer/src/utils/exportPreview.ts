import type { ExportSortMode, ExportSourceType } from '../types/export'
import type { LikedSong, PlaylistTrack } from '../types/song'

export type PreviewSong = LikedSong | PlaylistTrack

export function sortPreviewSongs(
  songs: PreviewSong[],
  sourceType: ExportSourceType,
  sortMode: ExportSortMode
): PreviewSong[] {
  return [...songs].sort((a, b) => {
    if (sortMode === 'originalOrder') {
      return a.orderIndex - b.orderIndex
    }

    const aTime = getPreviewSongTime(a, sourceType)
    const bTime = getPreviewSongTime(b, sourceType)

    if (aTime === null && bTime === null) {
      return a.orderIndex - b.orderIndex
    }

    if (aTime === null) {
      return 1
    }

    if (bTime === null) {
      return -1
    }

    return sortMode === 'timeDesc' ? bTime - aTime : aTime - bTime
  })
}

export function getPreviewSongTime(song: PreviewSong, sourceType: ExportSourceType): number | null {
  if (sourceType === 'liked') {
    return 'likedAt' in song && song.likedAt ? song.likedAt : null
  }

  return 'addedAt' in song && song.addedAt ? song.addedAt : null
}
