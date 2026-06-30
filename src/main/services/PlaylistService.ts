import { PlaylistRepository } from '../db/repositories/PlaylistRepository'

export class PlaylistService {
  constructor(private readonly playlistRepository = new PlaylistRepository()) {}

  getPlaylistCount(): number {
    return this.playlistRepository.count()
  }
}
