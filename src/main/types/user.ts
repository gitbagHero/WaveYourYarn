export interface NCMUserProfile {
  userId: string
  nickname: string
  avatarUrl?: string
  signature?: string
  rawData?: unknown
}

export interface UserProfile {
  id: string
  ncmUserId: string
  nickname: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}
