import { describe, it, expect, vi, beforeEach } from 'vitest'

const BASE = 'https://gw.example/v1'
const KEY = 'sk-test'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const okPayload = {
  choices: [{
    finish_reason: 'stop',
    message: { role: 'assistant', content: '你好', tool_calls: null, reasoning_content: '想了一下' },
  }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
}

describe('lib/llm/client', () => {
  beforeEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

  async function importClient(env: Record<string, string | undefined>) {
    for (const k of ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL']) {
      if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]
    }
    const mod = await import('./client')
    return mod
  }

  it('env 缺失时 llmAvailable() 为 false，chatOnce 返回 null', async () => {
    const { llmAvailable, chatOnce } = await importClient({ LLM_BASE_URL: undefined, LLM_API_KEY: undefined, LLM_MODEL: undefined })
    expect(llmAvailable()).toBe(false)
    expect(await chatOnce({ messages: [{ role: 'user', content: 'hi' }] })).toBeNull()
  })

  it('chatOnce 发送 OpenAI 兼容请求并解析响应', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(okPayload))
    vi.stubGlobal('fetch', fetchMock)
    const { chatOnce } = await importClient({ LLM_BASE_URL: BASE, LLM_API_KEY: KEY, LLM_MODEL: 'ling-3.1-flash' })
    const result = await chatOnce({ messages: [{ role: 'user', content: 'hi' }] })
    expect(result?.content).toBe('你好')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${BASE}/chat/completions`)
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`)
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('ling-3.1-flash')
    expect(body.messages).toHaveLength(1)
  })

  it('工具与非流式参数正确传递', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(okPayload))
    vi.stubGlobal('fetch', fetchMock)
    const { chatOnce } = await importClient({ LLM_BASE_URL: BASE, LLM_API_KEY: KEY, LLM_MODEL: 'm' })
    await chatOnce({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 't', description: 'd', parameters: { type: 'object', properties: {} } } }],
    })
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.tools[0].function.name).toBe('t')
    expect(body.stream).toBeFalsy()
  })

  it('tool_calls 响应被解析为结构化数组', async () => {
    const payload = {
      choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [
        { id: 'call_1', type: 'function', function: { name: 'search_company', arguments: '{"name":"茅台"}' } },
      ] } }],
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)
    const { chatOnce } = await importClient({ LLM_BASE_URL: BASE, LLM_API_KEY: KEY, LLM_MODEL: 'm' })
    const result = await chatOnce({ messages: [{ role: 'user', content: '查茅台' }] })
    expect(result?.toolCalls).toEqual([{ id: 'call_1', name: 'search_company', arguments: { name: '茅台' } }])
  })

  it('message 为 {content:null, tool_calls:null} 时 chatOnce 返回 null', async () => {
    const payload = { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: null, tool_calls: null } }] }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)
    const { chatOnce } = await importClient({ LLM_BASE_URL: BASE, LLM_API_KEY: KEY, LLM_MODEL: 'm' })
    expect(await chatOnce({ messages: [{ role: 'user', content: 'hi' }] })).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('非法 JSON 响应重试 1 次后返回 null', async () => {
    const bad = new Response('not-json{', { status: 200 })
    const fetchMock = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(bad)
    vi.stubGlobal('fetch', fetchMock)
    const { chatOnce } = await importClient({ LLM_BASE_URL: BASE, LLM_API_KEY: KEY, LLM_MODEL: 'm' })
    expect(await chatOnce({ messages: [{ role: 'user', content: 'hi' }] })).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('HTTP 500 / AbortError 返回 null 且不重试', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
    vi.stubGlobal('fetch', fetchMock)
    const { chatOnce } = await importClient({ LLM_BASE_URL: BASE, LLM_API_KEY: KEY, LLM_MODEL: 'm' })
    expect(await chatOnce({ messages: [{ role: 'user', content: 'hi' }] })).toBeNull()
    expect(await chatOnce({ messages: [{ role: 'user', content: 'hi' }] })).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('chatStream 逐段产出 delta 文本并以 done 结束', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"你"},"index":0}]}\n\n',
      'data: {"choices":[{"delta":{"content":"好"},"index":0}]}\n\n',
      'data: [DONE]\n\n',
    ].join('')
    const fetchMock = vi.fn().mockResolvedValue(new Response(sse, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { chatStream } = await importClient({ LLM_BASE_URL: BASE, LLM_API_KEY: KEY, LLM_MODEL: 'm' })
    const parts: string[] = []
    for await (const ev of chatStream({ messages: [{ role: 'user', content: 'hi' }] })) {
      if (ev.type === 'delta') parts.push(ev.text)
    }
    expect(parts.join('')).toBe('你好')
  })

  it('chatStream 遇 HTTP 500 恰产出一个 done、零个 delta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 500))
    vi.stubGlobal('fetch', fetchMock)
    const { chatStream } = await importClient({ LLM_BASE_URL: BASE, LLM_API_KEY: KEY, LLM_MODEL: 'm' })
    const events: { type: string; text?: string }[] = []
    for await (const ev of chatStream({ messages: [{ role: 'user', content: 'hi' }] })) {
      events.push(ev)
    }
    expect(events).toEqual([{ type: 'done' }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
