import { SongRepository } from '../db/repositories/SongRepository'

export class SongService {
  constructor(private readonly songRepository = new SongRepository()) {}

  getLikedSongsCount(): number {
    return this.songRepository.count()
  }
}
