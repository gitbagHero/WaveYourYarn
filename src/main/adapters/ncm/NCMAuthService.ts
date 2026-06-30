export class NCMAuthService {
  async getLoginStatus(): Promise<unknown> {
    return {
      connected: false,
      message: 'Netease Cloud Music login is not implemented yet.'
    }
  }
}
