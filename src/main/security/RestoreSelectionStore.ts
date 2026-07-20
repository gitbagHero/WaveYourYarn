import { nanoid } from 'nanoid'

export class RestoreSelectionStore {
  private readonly selections = new Map<string, { backupPath: string; expiresAt: number }>()

  constructor(
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly createToken: () => string = nanoid
  ) {}

  issue(backupPath: string, now = Date.now()): string {
    this.prune(now)
    const token = this.createToken()
    this.selections.set(token, {
      backupPath,
      expiresAt: now + this.ttlMs
    })
    return token
  }

  consume(token: string, now = Date.now()): string | null {
    this.prune(now)
    const selection = this.selections.get(token)
    this.selections.delete(token)

    if (!selection || selection.expiresAt <= now) {
      return null
    }

    return selection.backupPath
  }

  private prune(now: number): void {
    for (const [token, selection] of this.selections) {
      if (selection.expiresAt <= now) {
        this.selections.delete(token)
      }
    }
  }
}
