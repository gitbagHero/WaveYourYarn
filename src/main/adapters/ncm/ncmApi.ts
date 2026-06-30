import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ncmApi = require('@neteasecloudmusicapienhanced/api') as Record<
  string,
  (params: Record<string, unknown>) => Promise<NcmResponse>
>

export interface NcmResponse {
  status?: number
  body?: Record<string, unknown>
  cookie?: string[]
}

export async function callNcmApi(
  method: string,
  params: Record<string, unknown>
): Promise<NcmResponse> {
  const handler = ncmApi[method]

  if (typeof handler !== 'function') {
    throw new Error(`api-enhanced 方法不存在：${method}`)
  }

  return handler(params)
}
