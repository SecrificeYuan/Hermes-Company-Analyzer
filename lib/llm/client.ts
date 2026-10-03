// OpenAI 兼容 LLM 网关薄客户端：认证、超时、JSON 重试 1 次、SSE 解析。任何失败返回 null/静默结束。

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
}

export interface ToolSpec {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export interface ChatResult {
  content: string | null
  toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[] | null
  finishReason: string
}

export interface ChatOptions {
  messages: ChatMessage[]
  tools?: ToolSpec[]
  maxTokens?: number
  /** 模型场景分档（chat/insight），经 LLM_MODEL_<SCENE> env 覆盖主模型 */
  scene?: string
  /** 单次请求超时（默认 30s）；喂推理模型大 payload 时按需加大 */
  timeoutMs?: number
  signal?: AbortSignal
}

const TIMEOUT_MS = 30_000

function llmConfig(scene?: string): { baseUrl: string; apiKey: string; model: string } | null {
  const baseUrl = process.env.LLM_BASE_URL?.replace(/\/+$/, '')
  const apiKey = process.env.LLM_API_KEY
  // per-scene 模型覆盖口：LLM_MODEL_CHAT / LLM_MODEL_INSIGHT 等，缺省回落主 LLM_MODEL
  const model =
    (scene ? process.env[`LLM_MODEL_${scene.toUpperCase()}`] : undefined) ?? process.env.LLM_MODEL
  if (!baseUrl || !apiKey || !model) return null
  return { baseUrl, apiKey, model }
}

export function llmAvailable(): boolean {
  return llmConfig() !== null
}

/** 当前场景实际生效的模型 id（用于把 model 维度写进缓存键，防换模型后回放旧内容） */
export function llmModelId(scene?: string): string {
  return llmConfig(scene)?.model ?? 'unknown'
}

function buildRequest(cfg: NonNullable<ReturnType<typeof llmConfig>>, opts: ChatOptions, stream: boolean) {
  return {
    url: `${cfg.baseUrl}/chat/completions`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: opts.messages,
        tools: opts.tools,
        max_tokens: opts.maxTokens,
        // deepseek 系网关偶尔在 stream 下漏掉最后一个 content 增量而以 [DONE] 截断；
        // stream_options 让 usage 走完整字段，实测不干扰协议，留作兜底稳态
        stream_options: stream ? { include_usage: true } : undefined,
        stream,
      }),
      signal: opts.signal,
    } satisfies RequestInit,
  }
}

function buildUrlSignal(signal: AbortSignal | undefined, timeoutMs?: number): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  if (signal) {
    if (signal.aborted) ctrl.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  const timer = setTimeout(() => ctrl.abort(), timeoutMs ?? TIMEOUT_MS)
  return {
    signal: ctrl.signal,
    clear: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

export async function chatOnce(opts: ChatOptions): Promise<ChatResult | null> {
  const cfg = llmConfig(opts.scene)
  if (!cfg) return null

  // 仅 JSON 解析失败重试 1 次；网络/HTTP 错误不重试
  for (let attempt = 0; attempt < 2; attempt++) {
    const { signal, clear } = buildUrlSignal(opts.signal, opts.timeoutMs)
    try {
      const { url, init } = buildRequest(cfg, opts, false)
      const res = await fetch(url, { ...init, signal })
      if (!res.ok) return null
      const raw = await res.text()
      let payload: unknown
      try {
        payload = JSON.parse(raw)
      } catch {
        continue // JSON 解析失败，重试 1 次
      }
      return parseChatResult(payload)
    } catch {
      return null // 网络错误 / 中断 / 超时
    } finally {
      clear()
    }
  }
  return null
}

function parseChatResult(payload: unknown): ChatResult | null {
  const choice = (payload as { choices?: { finish_reason?: string; message?: unknown }[] })?.choices?.[0]
  const msg = choice?.message as
    | { content?: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] | null }
    | undefined
  if (!msg) return null
  const toolCalls = msg.tool_calls?.length
    ? msg.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function?.name ?? '',
        arguments: safeParseArgs(tc.function?.arguments),
      }))
    : null
  if ((msg.content ?? null) === null && toolCalls === null) return null
  return { content: msg.content ?? null, toolCalls, finishReason: choice?.finish_reason ?? 'stop' }
}

function safeParseArgs(args: string | undefined): Record<string, unknown> {
  if (!args) return {}
  try {
    const parsed: unknown = JSON.parse(args)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function* chatStream(opts: ChatOptions): AsyncGenerator<{ type: 'delta'; text: string } | { type: 'done' }> {
  let finished = false
  try {
    const cfg = llmConfig(opts.scene)
    if (!cfg) return
    const { signal, clear } = buildUrlSignal(opts.signal, opts.timeoutMs)
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    try {
      const { url, init } = buildRequest(cfg, opts, true)
      const res = await fetch(url, { ...init, signal })
      if (!res.ok || !res.body) return
      // Node 18+/浏览器均提供 getReader；jsdom 下 Response 来自 undici，也支持
      reader = (res.body as unknown as { getReader(): ReadableStreamDefaultReader<Uint8Array> }).getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const t = line.trim()
          if (!t.startsWith('data:')) continue
          const data = t.slice(5).trim()
          if (data === '[DONE]') {
            finished = true
            yield { type: 'done' }
            return
          }
          let parsed: unknown
          try {
            parsed = JSON.parse(data)
          } catch {
            continue // 单行解析失败跳过
          }
          const delta = (parsed as { choices?: { delta?: { content?: string } }[] })?.choices?.[0]?.delta?.content
          if (delta) yield { type: 'delta', text: delta }
        }
      }
    } finally {
      // 释放 reader，避免消费端 break/异常/超时导致连接悬挂
      if (reader) await reader.cancel().catch(() => {})
      clear()
    }
  } catch {
    // 任何失败静默结束
  } finally {
    // 除 [DONE] 分支外，所有退出路径统一补一个 done
    if (!finished) yield { type: 'done' }
  }
}
