import { NCMAdapter } from '../adapters/ncm/NCMAdapter'

export class AuthService {
  constructor(private readonly ncmAdapter = new NCMAdapter()) {}

  async getLoginStatus(): Promise<unknown> {
    return this.ncmAdapter.auth.getLoginStatus()
  }
}
