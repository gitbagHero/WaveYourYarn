import { SettingsRepository } from '../db/repositories/SettingsRepository'

export class SettingsService {
  constructor(private readonly settingsRepository = new SettingsRepository()) {}

  get(key: string): string | null {
    return this.settingsRepository.get(key)
  }
}
