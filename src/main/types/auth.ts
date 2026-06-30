import type { UserProfile } from './user'

export type QrLoginStatus = 'waiting' | 'scanned' | 'authorized' | 'expired' | 'failed'

export interface LoginQrResult {
  key: string
  qrUrl?: string
  qrImageBase64?: string
}

export interface QrStatusResult {
  status: QrLoginStatus
  code?: number
  message?: string
  cookie?: string
  user?: UserProfile
}

export interface LoginStatusResult {
  isLoggedIn: boolean
  user?: UserProfile
}

export type LoginMethod = 'web' | 'qr' | 'manual_cookie'
