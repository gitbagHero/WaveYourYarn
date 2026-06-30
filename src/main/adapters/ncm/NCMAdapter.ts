import { NCMAuthService } from './NCMAuthService'
import { NCMUserService } from './NCMUserService'
import { NCMSongService } from './NCMSongService'
import { NCMPlaylistService } from './NCMPlaylistService'

export class NCMAdapter {
  readonly auth = new NCMAuthService()
  readonly user = new NCMUserService()
  readonly songs = new NCMSongService()
  readonly playlists = new NCMPlaylistService()
}
