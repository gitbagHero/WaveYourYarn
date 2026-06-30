export interface IpcResult<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}
