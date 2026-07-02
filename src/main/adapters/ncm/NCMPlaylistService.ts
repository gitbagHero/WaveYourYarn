import { logger } from '../../utils/logger'
import { callNcmApi } from './ncmApi'

const PLAYLIST_PAGE_SIZE = 100

export type NcmPlaylistRaw = Record<string, unknown>
export type NcmPlaylistDetailRaw = Record<string, unknown>

export class NCMPlaylistService {
  async getUserPlaylists(userId: string, cookie: string): Promise<NcmPlaylistRaw[]> {
    const playlists: NcmPlaylistRaw[] = []

    for (let offset = 0; ; offset += PLAYLIST_PAGE_SIZE) {
      const response = await callNcmApi('user_playlist', {
        uid: userId,
        limit: PLAYLIST_PAGE_SIZE,
        offset,
        cookie,
        timestamp: Date.now()
      })
      const pagePlaylists = response.body?.playlist

      if (!Array.isArray(pagePlaylists)) {
        throw new Error('网易云用户歌单返回结构异常')
      }

      playlists.push(...(pagePlaylists as NcmPlaylistRaw[]))
      logger.info('用户歌单分页获取成功', {
        offset,
        count: pagePlaylists.length,
        more: response.body?.more === true
      })

      if (pagePlaylists.length < PLAYLIST_PAGE_SIZE || response.body?.more !== true) {
        break
      }
    }

    return playlists
  }

  async getPlaylistDetail(ncmPlaylistId: string, cookie: string): Promise<NcmPlaylistDetailRaw> {
    const response = await callNcmApi('playlist_detail', {
      id: ncmPlaylistId,
      cookie,
      timestamp: Date.now()
    })
    const playlist = response.body?.playlist

    if (!playlist || typeof playlist !== 'object') {
      throw new Error('网易云歌单详情返回结构异常')
    }

    return playlist as NcmPlaylistDetailRaw
  }
}
