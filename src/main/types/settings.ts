export const AI_DISCLOSURE_CONFIRMATION_MODES = ['always', 'allow_remembered'] as const
export type AIDisclosureConfirmationMode = (typeof AI_DISCLOSURE_CONFIRMATION_MODES)[number]

export type PublicSettingKey = 'default_export_directory' | 'ai_disclosure_confirmation_mode'

export interface PublicSettings {
  default_export_directory?: string
  ai_disclosure_confirmation_mode?: AIDisclosureConfirmationMode
}
