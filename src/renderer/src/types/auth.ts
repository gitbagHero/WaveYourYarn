import type { UserProfile } from './user'

export type QrLoginStatus = 'waiting' | 'scanned' | 'authorized' | 'expired' | 'failed'

export interface LoginQrResult {
  key: string
  qrUrl?: string
  qrImageBase64?: string
}

export interface QrStatusResult {
  status: QrLoginStatus
  message?: string
  user?: UserProfile
}

export interface LoginStatusResult {
  isLoggedIn: boolean
  user?: UserProfile
}
