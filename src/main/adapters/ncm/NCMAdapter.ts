import { NCMAuthService } from './NCMAuthService'
import { NCMUserService } from './NCMUserService'
import { NCMSongService } from './NCMSongService'
import { NCMPlaylistService } from './NCMPlaylistService'

type CookieProvider = () => Promise<string | null>

export class NCMAdapter {
  readonly auth: NCMAuthService
  readonly user: NCMUserService
  readonly songs = new NCMSongService()
  readonly playlists = new NCMPlaylistService()

  constructor(getCookie?: CookieProvider) {
    this.auth = new NCMAuthService(getCookie)
    this.user = new NCMUserService(getCookie)
  }
}
