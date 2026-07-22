import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import type { DevelopmentLLMConfig } from '../../config/developmentLlmConfig'
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider'

let server: Server | undefined

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server?.close((error) => (error ? reject(error) : resolve()))
    )
    server = undefined
  }
})

describe('OpenAICompatibleProvider', () => {
  it('uses the Chat Completions contract without exposing configuration in the result', async () => {
    let receivedPath = ''
    let receivedAuthorization = ''
    let receivedUserAgent = ''
    let receivedBody: Record<string, unknown> = {}
    server = createServer((request, response) => {
      receivedPath = request.url ?? ''
      receivedAuthorization = String(request.headers.authorization ?? '')
      receivedUserAgent = String(request.headers['user-agent'] ?? '')
      const chunks: Buffer[] = []
      request.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      request.on('end', () => {
        receivedBody = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }))
      })
    })
    const port = await listen(server)
    const provider = new OpenAICompatibleProvider(configFor(port))

    const result = await provider.createChatCompletion({
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 100,
      reasoningEffort: 'low',
      responseFormat: 'json_object'
    })

    expect(result).toBe('{"ok":true}')
    expect(receivedPath).toBe('/nested/v1/chat/completions')
    expect(receivedAuthorization).toBe('Bearer fake-key')
    expect(receivedUserAgent).toBe('WaveYourYarn/0.3')
    expect(receivedBody).toMatchObject({
      model: 'fake-model',
      stream: false,
      max_tokens: 100,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: 'ping' }]
    })
  })

  it('maps authentication failures without persisting the provider response body', async () => {
    server = createServer((_request, response) => {
      response.writeHead(401, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: { message: 'sensitive upstream detail' } }))
    })
    const port = await listen(server)
    const provider = new OpenAICompatibleProvider(configFor(port))

    await expect(
      provider.createChatCompletion({ messages: [{ role: 'user', content: 'ping' }] })
    ).rejects.toMatchObject({
      code: 'LLM_AUTH_FAILED',
      status: 401,
      message: '模型服务鉴权失败。'
    })
  })

  it.each([
    [404, 'LLM_MODEL_NOT_FOUND', '模型或接口不存在。'],
    [429, 'LLM_RATE_LIMITED', '模型服务当前限流。'],
    [500, 'LLM_PROVIDER_ERROR', '模型服务返回错误。']
  ] as const)('maps provider status %s to a stable error', async (status, code, message) => {
    server = createServer((_request, response) => {
      response.writeHead(status, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: { message: 'raw upstream details must stay hidden' } }))
    })
    const port = await listen(server)
    const provider = new OpenAICompatibleProvider(configFor(port))

    await expect(
      provider.createChatCompletion({ messages: [{ role: 'user', content: 'ping' }] })
    ).rejects.toMatchObject({ code, status, message })
  })

  it('rejects invalid JSON and empty completion content', async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end('not-json')
    })
    const port = await listen(server)
    const provider = new OpenAICompatibleProvider(configFor(port))
    await expect(
      provider.createChatCompletion({ messages: [{ role: 'user', content: 'ping' }] })
    ).rejects.toMatchObject({ code: 'LLM_OUTPUT_INVALID' })

    await closeServer()
    server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ choices: [{ message: { content: '' } }] }))
    })
    const secondPort = await listen(server)
    const secondProvider = new OpenAICompatibleProvider(configFor(secondPort))
    await expect(
      secondProvider.createChatCompletion({ messages: [{ role: 'user', content: 'ping' }] })
    ).rejects.toMatchObject({ code: 'LLM_OUTPUT_INVALID' })
  })
})

async function listen(target: Server): Promise<number> {
  await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve))
  const address = target.address()
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not expose a TCP port.')
  }
  return address.port
}

function configFor(port: number): DevelopmentLLMConfig {
  const baseUrl = new URL(`http://127.0.0.1:${port}/nested/v1/`)
  return {
    protocol: 'openai_chat_completions',
    baseUrl,
    chatCompletionsUrl: new URL('chat/completions', baseUrl),
    modelId: 'fake-model',
    apiKey: 'fake-key',
    timeoutMs: 2_000
  }
}

async function closeServer(): Promise<void> {
  if (!server) {
    return
  }
  const current = server
  server = undefined
  await new Promise<void>((resolve, reject) =>
    current.close((error) => (error ? reject(error) : resolve()))
  )
}
