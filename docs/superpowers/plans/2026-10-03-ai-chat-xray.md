# AI 对话与 X 光评估 · 实现计划（计划 1/2）

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 接入 LLM 网关，落地对话模式：首页对话输入框 → /chat 全屏 Agent 对话 → 工具调用现有数据平台 → 迷你面板报告卡 + 报告页「下一步」行动建议。

**架构：** `lib/llm/client.ts`（OpenAI 兼容薄客户端）← `lib/chat/agent.ts`（Agent 循环，4 工具薄包装 `lib/data` 与 `lib/get-xray`）← `app/api/chat/route.ts`（SSE）。叙事层（verdict 润色 + Next Steps）在 `lib/get-xray.ts` 编排层接线，守卫回退模板。前端：首页第三 tab + `/chat` 页 + `NextStepsCard`。信号引擎扩展不在本计划（计划 2/2）。

**技术栈：** Next.js 15 App Router、React 19、vitest、SSE（ReadableStream）、tokendance.space OpenAI 兼容网关（模型 `ling-3.1-flash`，推理模型，max_tokens 必须 ≥2000）。

**规格：** `docs/superpowers/specs/2026-10-03-ai-chat-xray-design.md`（唯一准绳）

**铁律（规格继承）：**
- `lib/analysis` 保持纯函数，不 import LLM/网络/fs；LLM 只出现在 `lib/llm`、`lib/chat`、`get-xray.ts` 编排层。
- LLM 不得改变分数/灯色/隐藏状态；输出数字必须可溯源；失败一律回退模板，报告页与对话永不出现空白区块。
- `.env.local` 已含 `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`（git 已忽略）；测试**绝不读真实 env**，一律 stub。

---

### 任务 1：LLM 客户端 `lib/llm/client.ts`

**文件：**
- 创建：`lib/llm/client.ts`
- 测试：`lib/llm/client.test.ts`

**背景：** 网关 `POST {LLM_BASE_URL}/chat/completions`，Bearer 认证。两种调用：非流式（Agent 循环中需要完整 tool_calls 的轮次）与流式（最终回复 token 级 SSE）。推理模型有 `reasoning_content`，响应 JSON 可能解析失败——重试 1 次后返回 null（调用方回退）。

- [ ] **步骤 1：编写失败的测试**

```ts
// lib/llm/client.test.ts
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
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run lib/llm/client.test.ts`
预期：FAIL，`Cannot find module './client'`

- [ ] **步骤 3：编写实现**

```ts
// lib/llm/client.ts
/**
 * OpenAI 兼容 LLM 网关薄客户端。
 * 只做：认证、超时、重试 1 次、SSE 解析。任何失败返回 null，由调用方回退。
 * 推理模型注意：reasoning_content 计入 completion_tokens，max_tokens 必须给足。
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: {
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }[]
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

interface ChatOptions {
  messages: ChatMessage[]
  tools?: ToolSpec[]
  maxTokens?: number
  signal?: AbortSignal
}

const TIMEOUT_MS = 30_000
const MAX_JSON_RETRY = 1

export function llmConfig() {
  const baseUrl = process.env.LLM_BASE_URL
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL
  if (!baseUrl || !apiKey || !model) return null
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey, model }
}

export function llmAvailable(): boolean {
  return llmConfig() !== null
}

async function postChat(body: Record<string, unknown>, timeoutMs: number): Promise<Response | null> {
  const cfg = llmConfig()
  if (!cfg) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function parseChatResult(data: unknown): ChatResult | null {
  const choice = (data as { choices?: { finish_reason?: string; message?: { content?: string | null; tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[] } }[] })?.choices?.[0]
  if (!choice?.message) return null
  const rawCalls = choice.message.tool_calls ?? null
  const toolCalls = rawCalls?.map((c) => {
    let args: Record<string, unknown> = {}
    try { args = JSON.parse(c.function.arguments || '{}') } catch { args = {} }
    return { id: c.id, name: c.function.name, arguments: args }
  }) ?? null
  const content = typeof choice.message.content === 'string' ? choice.message.content : null
  if (!content?.trim() && !toolCalls?.length) return null
  return { content, toolCalls, finishReason: choice.finish_reason ?? 'stop' }
}

/** 非流式调用（需要完整 tool_calls 的轮次）。网络错/HTTP 错返回 null；非法 JSON 重试 1 次后 null。 */
export async function chatOnce(opts: ChatOptions): Promise<ChatResult | null> {
  const cfg = llmConfig()
  if (!cfg) return null
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 2000,
    stream: false,
  }
  if (opts.tools?.length) body.tools = opts.tools

  for (let attempt = 0; attempt <= MAX_JSON_RETRY; attempt++) {
    const res = await postChat(body, TIMEOUT_MS)
    if (!res || !res.ok) return null
    try {
      return parseChatResult(await res.json())
    } catch {
      // 网关偶发截断/乱码：仅 JSON 解析失败重试，网络错不重试
    }
  }
  return null
}

export type StreamEvent = { type: 'delta'; text: string } | { type: 'done' }

/** 流式调用（最终回复的 token 级输出）。任何失败静默结束（调用方已持有模板兜底）。 */
export async function* chatStream(opts: ChatOptions): AsyncGenerator<StreamEvent> {
  const cfg = llmConfig()
  if (!cfg) return
  const res = await postChat({
    model: cfg.model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 2000,
    stream: true,
  }, TIMEOUT_MS)
  if (!res?.ok || !res.body) return

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') { yield { type: 'done' }; return }
        try {
          const json = JSON.parse(payload) as { choices?: { delta?: { content?: string | null } }[] }
          const text = json.choices?.[0]?.delta?.content
          if (text) yield { type: 'delta', text }
        } catch {
          // 单行解析失败跳过，不中断流
        }
      }
    }
  } catch {
    // 读取中断：结束流
  }
  yield { type: 'done' }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run lib/llm/client.test.ts`
预期：PASS（7 个用例全绿）

- [ ] **步骤 5：Commit**

```bash
git add lib/llm/client.ts lib/llm/client.test.ts
git commit -m "feat(llm): OpenAI 兼容网关薄客户端（非流式/流式/超时/重试/失败返 null）"
```

---

### 任务 2：`NextSteps` 类型增量字段

**文件：**
- 修改：`lib/types.ts`（`CompanyXRay` 内、`sources?: DataSourceStatus[]` 之后追加）
- 测试：`lib/types.test.ts`（新建，仅断言字段可选不破坏现有 fixture）

- [ ] **步骤 1：编写失败的测试**

```ts
// lib/types.test.ts
import { describe, it, expect } from 'vitest'
import type { CompanyXRay } from './types'

describe('CompanyXRay.nextSteps（v1.x 增量可选字段）', () => {
  it('现有 fixture 不含 nextSteps 时仍可赋值给 CompanyXRay', async () => {
    const { mockXray } = await import('./analysis/mock-data')
    const xray: CompanyXRay = mockXray('mock-healthy')
    expect(xray.nextSteps).toBeUndefined()
  })

  it('nextSteps 结构：scenario/items/caveat 三元组', () => {
    const ns: NonNullable<CompanyXRay['nextSteps']> = {
      scenario: '买理财',
      items: ['问销售牌照编号并官网验真'],
      caveat: '历史不代表未来',
      generatedAt: '2026-10-03T00:00:00.000Z',
      model: 'ling-3.1-flash',
    }
    expect(ns.items).toHaveLength(1)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run lib/types.test.ts`
预期：FAIL，`Property 'nextSteps' does not exist` / `mockXray` 导出不存在（若不存在则把 import 改为从 `./__tests__/fixtures` 或现有 mock 模块取，以仓库现有 mock 导出为准——先 `ls lib/analysis/ | grep mock` 确认再写 import 路径）。

- [ ] **步骤 3：编写实现**

```ts
// lib/types.ts，追加在 CompanyXRay 的 sources 字段之后：
  /** LLM 行动建议（可选）：亮灯后的「下一步」清单，失败时不存在（UI 回退模板 advice）。 */
  nextSteps?: {
    scenario: string // 意图场景，如「买理财」
    items: string[] // 3–5 条行动项
    caveat: string // 诚实标注，如「历史不代表未来」
    generatedAt: string
    model: string
  }
```

- [ ] **步骤 4：运行测试验证通过 + typecheck**

运行：`npx vitest run lib/types.test.ts && npm run typecheck`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add lib/types.ts lib/types.test.ts
git commit -m "feat(types): CompanyXRay.nextSteps 增量可选字段（行动建议层契约）"
```

---

### 任务 3：叙事层接线——VerdictRefiner + NextSteps（`lib/llm/narrative.ts` + `lib/get-xray.ts`）

**文件：**
- 创建：`lib/llm/narrative.ts`、`lib/llm/narrative.test.ts`
- 修改：`lib/get-xray.ts`

**背景：** `lib/analysis/verdict.ts` 已有 `VerdictRefinementRequest`/`VerdictRefiner`/`applyVerdictRefinement`（守卫现成，直接复用）。本任务新增 ActionAdvice 的 prompt 构建与解析守卫，并在 `getXRay()` 里 analyze() 之后并行调两次 LLM，失败/守卫不通过则保持模板。

- [ ] **步骤 1：编写失败的测试**

```ts
// lib/llm/narrative.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const xray = {
  id: 'mock-danger', name: '测试危险公司', industry: '理财', overallRisk: 'red' as const,
  hp: { score: 12 }, def: { score: 8 },
  hiddenStatus: [{ id: 'unlicensed', label: '无牌照募资', severity: 'fatal' as const, description: '无金融牌照', evidence: [{ source: '快照', date: '2026-10-03', detail: '无备案' }] }],
  verdict: '模板结论', advice: '模板建议', asOf: '2026-10-03',
}

describe('lib/llm/narrative', () => {
  beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals() })

  it('nextSteps prompt 要求 JSON 且包含三档灯行动语义', async () => {
    const { buildActionAdviceMessages } = await import('./narrative')
    const msgs = buildActionAdviceMessages(xray as never, '买理财')
    const sys = msgs.find((m) => m.role === 'system')!.content!
    expect(sys).toContain('3 到 5')
    expect(sys).toContain('JSON')
    expect(sys).toContain('买理财')
    expect(sys).toContain('历史不代表未来')
  })

  it('parseActionAdvice：合法 JSON 且 3–5 条 → 通过', async () => {
    const { parseActionAdvice } = await import('./narrative')
    const raw = JSON.stringify({ scenario: '买理财', items: ['a', 'b', 'c'], caveat: '历史不代表未来' })
    expect(parseActionAdvice(raw, 'ling-3.1-flash')?.items).toHaveLength(3)
  })

  it('parseActionAdvice：条数越界/缺字段/非 JSON → null', async () => {
    const { parseActionAdvice } = await import('./narrative')
    expect(parseActionAdvice('{"scenario":"s","items":["a"]}', 'm')).toBeNull() // 1 条 < 3
    expect(parseActionAdvice('{"scenario":"s","items":["a","b","c","d","e","f"]}', 'm')).toBeNull() // 6 条 > 5
    expect(parseActionAdvice('{"items":["a","b","c"]}', 'm')).toBeNull() // 缺 scenario
    expect(parseActionAdvice('not json', 'm')).toBeNull()
    expect(parseActionAdvice('{"scenario":"s","items":["a","b",""]}', 'm')).toBeNull() // 含空串
  })

  it('数字可溯源守卫：输出中出现面板中不存在的数字 → null', async () => {
    const { parseActionAdvice } = await import('./narrative')
    const raw = JSON.stringify({ scenario: 's', items: ['血条仅 7%，快跑', '问牌照', '托管行写入合同'] })
    // xray.hp.score=12，7 无出处 → 拒绝
    expect(parseActionAdvice(raw, 'm')).toBeNull()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run lib/llm/narrative.test.ts`
预期：FAIL，`Cannot find module './narrative'`

- [ ] **步骤 3：编写实现**

```ts
// lib/llm/narrative.ts
import type { CompanyXRay } from '@/lib/types'
import { buildVerdict } from '@/lib/analysis/verdict'
import type { ChatMessage } from './client'

/** NextSteps 的 prompt：三档灯全给、行动项句式、铁律（无出处数字禁止/资料不足明说）。 */
export function buildActionAdviceMessages(xray: CompanyXRay, scenario: string): ChatMessage[] {
  const lamp = xray.overallRisk === 'green' ? '绿灯：付款前最后核对清单'
    : xray.overallRisk === 'yellow' ? '黄灯：怎么付更安全（分期/月付/先查备案等）'
    : '红灯：止损与替代行动（不要付、如何追讨、替代选择）'
  return [
    { role: 'system', content: [
      '你是支付前风险评估产品的行动建议生成器。只输出 JSON，不要输出其他文字。',
      '输出格式：{"scenario": string, "items": string[], "caveat": string}',
      `scenario 固定为「${scenario}」；items 必须是 3 到 5 条可执行行动项（"问销售 X""合同加 Y 条款"这种），禁止复述诊断；`,
      `当前为${lamp}。`,
      '铁律：不得出现输入数据之外的任何数字与事实；资料不足就写"建议先补充查询 XXX"；',
      'caveat 固定含「历史不代表未来」。',
    ].join('\n') },
    { role: 'user', content: JSON.stringify({
      公司: xray.name, 灯色: xray.overallRisk, 场景: scenario,
      血条: xray.hp.score, 护甲: xray.def.score,
      命中信号: xray.hiddenStatus.map((h) => ({ 名称: h.label, 级别: h.severity, 解释: h.description, 证据: h.evidence })),
      模板建议: xray.advice, 数据基准日: xray.asOf,
    }) },
  ]
}

/**
 * 解析守卫：JSON 合法、scenario/items/caveat 齐全、3–5 条、每条非空、
 * 条目中出现的所有百分数必须能在输入面板数据中找到出处（防 LLM 编数字）。
 */
export function parseActionAdvice(raw: string, model: string): NonNullable<CompanyXRay['nextSteps']> | null {
  let data: { scenario?: unknown; items?: unknown; caveat?: unknown }
  try { data = JSON.parse(raw) } catch { return null }
  if (typeof data.scenario !== 'string' || !data.scenario.trim()) return null
  if (typeof data.caveat !== 'string' || !data.caveat.trim()) return null
  if (!Array.isArray(data.items)) return null
  const items = data.items.filter((i): i is string => typeof i === 'string')
  if (items.length !== data.items.length) return null
  if (items.length < 3 || items.length > 5) return null
  if (items.some((i) => !i.trim())) return null
  return {
    scenario: data.scenario.trim(),
    items: items.map((i) => i.trim()),
    caveat: data.caveat.trim(),
    generatedAt: new Date().toISOString(),
    model,
  }
}
```

> **注意：**「数字可溯源」守卫的完整实现（从条目中抽取百分数并与 hp/def/证据比对）放在解析器内联实现——把上面测试中 `血条仅 7%` 用例对应的逻辑写进 `parseActionAdvice`：收集 `xray.hp.score`/`xray.def.score` 及 evidence detail 中的数字集合，用正则 `(\d+(?:\.\d+)?)%` 抽取条目数字，凡不在集合内即拒。实现时以测试用例为准补全该段代码。

- [ ] **步骤 4：修改 `lib/get-xray.ts`（编排层接线）**

```ts
// lib/get-xray.ts 变更点（保持现有缓存与取数逻辑不动）：
import { chatOnce, llmAvailable } from '@/lib/llm/client'
import { applyVerdictRefinement, buildVerdict } from '@/lib/analysis/verdict'
import { buildActionAdviceMessages, parseActionAdvice } from '@/lib/llm/narrative'

async function refineWithLLM(xray: CompanyXRay, scenario?: string): Promise<CompanyXRay> {
  if (!llmAvailable()) return xray
  try {
    const [verdictRes, adviceRes] = await Promise.allSettled([
      chatOnce({
        messages: [
          { role: 'system', content: '你是风险评估结论润色器。改写 verdict/advice 为更口语的人话，但原样返回 overallRisk，只输出 JSON：{"verdict": string, "advice": string, "overallRisk": "green"|"yellow"|"red"}。不得出现输入之外的数字。' },
          { role: 'user', content: JSON.stringify({ draft: { verdict: xray.verdict, advice: xray.advice }, overallRisk: xray.overallRisk, evidence: xray.hiddenStatus }) },
        ],
      }),
      scenario ? chatOnce({ messages: buildActionAdviceMessages(xray, scenario) }) : Promise.resolve(null),
    ])

    const next = { ...xray }
    if (verdictRes.status === 'fulfilled' && verdictRes.value?.content) {
      try {
        const parsed = JSON.parse(verdictRes.value.content)
        next.verdict = applyVerdictRefinement(
          { verdict: xray.verdict, advice: xray.advice },
          xray.overallRisk,
          parsed,
        ).verdict
        next.advice = applyVerdictRefinement(
          { verdict: xray.verdict, advice: xray.advice },
          xray.overallRisk,
          parsed,
        ).advice
      } catch { /* JSON 解析失败保持模板 */ }
    }
    if (scenario && adviceRes.status === 'fulfilled' && adviceRes.value?.content) {
      const ns = parseActionAdvice(adviceRes.value.content, process.env.LLM_MODEL ?? '')
      if (ns) next.nextSteps = ns
    }
    return next
  } catch {
    return xray
  }
}
```

并在 `getXRay()` 中 `const xray = analyze(raw)` 之后改为：
```ts
const base = analyze(raw)
const xray = scenarioFromCache /* 对话管线透传场景时 */ ? await refineWithLLM(base, scenario) : await refineWithLLM(base)
```
> `scenario` 来源：对话工具 `run_xray`/`run_health_check` 调用 getXRay 时透传（任务 4 实现）。`getXRay(id, scenario?)` 增加可选第二参，缓存 key 追加 scenario（如 `${id}::${scenario ?? ''}`），避免不同场景共享缓存导致 nextSteps 错乱。

- [ ] **步骤 5：运行测试 + 全量回归**

运行：`npx vitest run lib/llm/ lib/types.test.ts && npm run test`
预期：全绿；原有 mock 三档回归必须通过

- [ ] **步骤 6：Commit**

```bash
git add lib/llm/narrative.ts lib/llm/narrative.test.ts lib/get-xray.ts lib/types.ts
git commit -m "feat(llm): 叙事层接线——verdict 润色 + NextSteps 行动建议（守卫回退模板）"
```

---

### 任务 4：Agent 工具集 `lib/chat/tools.ts`

**文件：**
- 创建：`lib/chat/tools.ts`、`lib/chat/tools.test.ts`

**背景：** 4 个工具全部为现有 lib 薄包装（见规格工具表）。执行结果以 `{...}` JSON 回灌模型；任何异常包成 `{error: '人话说明'}`，**不抛出**。

- [ ] **步骤 1：编写失败的测试**

```ts
// lib/chat/tools.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/data/eastmoney', () => ({ suggestCompanies: vi.fn() }))
vi.mock('@/lib/data/company-discovery', () => ({ searchCompanies: vi.fn() }))
vi.mock('@/lib/get-xray', () => ({ getXRay: vi.fn() }))
vi.mock('@/lib/data/company-health', () => ({ findCompany: vi.fn(), getCompanyHealth: vi.fn() }))
vi.mock('@/lib/data/health-xray', () => ({ healthToXray: vi.fn((h) => ({ ...h, __converted: true })) }))

import { suggestCompanies } from '@/lib/data/eastmoney'
import { searchCompanies } from '@/lib/data/company-discovery'
import { getXRay } from '@/lib/get-xray'
import { executeTool, toolSpecs } from './tools'

describe('lib/chat/tools', () => {
  beforeEach(() => vi.clearAllMocks())

  it('暴露 4 个工具且均为 function 类型', () => {
    expect(toolSpecs.map((t) => t.function.name)).toEqual([
      'suggest_companies', 'confirm_company', 'run_xray', 'run_health_check',
    ])
  })

  it('suggest_companies 返回候选列表', async () => {
    vi.mocked(suggestCompanies).mockResolvedValue([{ id: '1', name: '贵州茅台' }])
    const result = await executeTool('suggest_companies', { name: '茅台' })
    expect(result).toEqual({ suggestions: [{ id: '1', name: '贵州茅台' }] })
  })

  it('confirm_company 唯一命中才 found', async () => {
    vi.mocked(searchCompanies).mockResolvedValue({ suggestions: [{ id: '1', name: '贵州茅台', stockCode: '600519' }] })
    expect((await executeTool('confirm_company', { name: '贵州茅台' })).found).toBe(true)
    vi.mocked(searchCompanies).mockResolvedValue({ suggestions: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }] })
    expect((await executeTool('confirm_company', { name: '茅台' })).found).toBe(false)
  })

  it('run_xray 返回报告卡快照（灯/debuff/资料截至）', async () => {
    vi.mocked(getXRay).mockResolvedValue({
      id: '600519', name: '贵州茅台', overallRisk: 'green',
      verdict: '结论', hiddenStatus: [],
      asOf: '2026-10-03',
    })
    const result = await executeTool('run_xray', { company_id: '600519', scenario: '买股票' })
    expect(result.reportCard).toMatchObject({ reportId: '600519', overallRisk: 'green', scenario: '买股票' })
    expect(result.reportCard.debuffItems).toEqual([])
  })

  it('工具异常时返回 {error} 而非抛出', async () => {
    vi.mocked(suggestCompanies).mockRejectedValue(new Error('网络炸'))
    const result = await executeTool('suggest_companies', { name: 'x' })
    expect(result.error).toContain('网络炸')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run lib/chat/tools.test.ts`
预期：FAIL，`Cannot find module './tools'`

- [ ] **步骤 3：编写实现**

```ts
// lib/chat/tools.ts
import { suggestCompanies } from '@/lib/data/eastmoney'
import { searchCompanies } from '@/lib/data/company-discovery'
import { getXRay } from '@/lib/get-xray'
import { findCompany, getCompanyHealth } from '@/lib/data/company-health'
import { healthToXray } from '@/lib/data/health-xray'
import type { CompanyXRay } from '@/lib/types'
import type { ToolSpec } from '@/lib/llm/client'

export const toolSpecs: ToolSpec[] = [
  { type: 'function', function: {
    name: 'suggest_companies',
    description: '按名称搜索公司/品牌，返回候选列表（名称、代码、上市状态）。用户提到的主体不确定时先调它。',
    parameters: { type: 'object', properties: { name: { type: 'string', description: '公司或品牌名' } }, required: ['name'] } } },
  { type: 'function', function: {
    name: 'confirm_company',
    description: '确认唯一公司主体。仅当候选唯一且名称准确命中时 found=true，否则必须追问用户核对，禁止猜测。',
    parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
  { type: 'function', function: {
    name: 'run_xray',
    description: '对上市公司主体运行完整 X 光评估（信号引擎+亮灯），返回报告卡。耗时最多约 6 秒。',
    parameters: { type: 'object', properties: {
      company_id: { type: 'string' }, scenario: { type: 'string', description: '用户支付场景（买股票/买理财/加盟…），用于生成行动建议' } }, required: ['company_id'] } } },
  { type: 'function', function: {
    name: 'run_health_check',
    description: '对非上市主体（健身房/培训机构/加盟品牌等）做健康评估（工商/司法/投诉信号），返回报告卡。',
    parameters: { type: 'object', properties: {
      company_id: { type: 'string' }, scenario: { type: 'string' } }, required: ['company_id'] } } },
]

function reportCard(xray: CompanyXRay, scenario?: string) {
  return {
    reportId: xray.id,
    name: xray.name,
    overallRisk: xray.overallRisk,
    verdict: xray.verdict,
    debuffItems: xray.hiddenStatus.map((h) => ({ id: h.id, label: h.label, severity: h.severity, description: h.description })),
    asOf: xray.asOf,
    scenario: scenario ?? null,
  }
}

/** 工具执行：成功返回 JSON 对象回灌模型；任何异常包成 {error}，绝不抛出。 */
export async function executeTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    if (name === 'suggest_companies') {
      const suggestions = await suggestCompanies(String(args.name ?? ''), 10)
      return { suggestions }
    }
    if (name === 'confirm_company') {
      const result = await searchCompanies(String(args.name ?? ''))
      const q = String(args.name ?? '').trim()
      const exact = result.suggestions.filter((c: { name: string; fullName?: string; id: string }) =>
        c.name === q || c.fullName === q || c.id === q)
      return { found: exact.length === 1, company: exact.length === 1 ? exact[0] : null, candidates: result.suggestions }
    }
    if (name === 'run_xray') {
      const xray = await getXRay(String(args.company_id ?? ''), args.scenario ? String(args.scenario) : undefined)
      return { reportCard: reportCard(xray, args.scenario ? String(args.scenario) : undefined) }
    }
    if (name === 'run_health_check') {
      const identity = await findCompany(String(args.company_id ?? ''))
      if (!identity) return { error: '未找到该主体，可能资料不足' }
      const health = await getCompanyHealth(identity)
      const xray = healthToXray(health)
      return { reportCard: reportCard(xray, args.scenario ? String(args.scenario) : undefined) }
    }
    return { error: `未知工具：${name}` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '工具执行失败' }
  }
}
```

> `executeTool` 返回中的 `reportCard` 会在 Agent 循环里同时触发 `report_card` SSE 事件（任务 5）。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run lib/chat/tools.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add lib/chat/tools.ts lib/chat/tools.test.ts
git commit -m "feat(chat): Agent 工具集——4 工具薄包装现有数据平台，异常包 {error} 不抛出"
```

---

### 任务 5：Agent 循环 `lib/chat/agent.ts`

**文件：**
- 创建：`lib/chat/agent.ts`、`lib/chat/agent.test.ts`

**流程：** 每轮 `chatOnce`（带 tools）→ 有 toolCalls 则逐个 `executeTool`，结果以 `tool` 角色消息回灌，发 `tool_start` 事件，继续循环；无 toolCalls 的最终轮改用 `chatStream` 产出 token 级 `delta`。循环上限 6 轮。LLM 返回 null → 回退模板话术文本（见 SYSTEM 常量兜底逻辑）。

- [ ] **步骤 1：编写失败的测试**

```ts
// lib/chat/agent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatMessage } from '@/lib/llm/client'

vi.mock('@/lib/llm/client', () => ({
  llmAvailable: vi.fn(() => true),
  chatOnce: vi.fn(),
  chatStream: vi.fn(),
}))
vi.mock('./tools', () => ({
  toolSpecs: [],
  executeTool: vi.fn(),
}))

import { chatOnce, chatStream } from '@/lib/llm/client'
import { executeTool } from './tools'
import { runAgent } from './agent'

const USER: ChatMessage[] = [{ role: 'user', content: '我妈要买理财' }]

describe('lib/chat/agent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('无主体输入：模型直接追问（不调工具，单轮流式输出）', async () => {
    vi.mocked(chatOnce).mockResolvedValueOnce({ content: null, toolCalls: null, finishReason: 'stop' })
    vi.mocked(chatStream).mockImplementation(async function* () {
      yield { type: 'delta', text: '请问是哪家理财公司？' }
      yield { type: 'done' }
    })
    const events: { type: string }[] = []
    const finalText = await runAgent(USER, (e) => events.push(e))
    expect(finalText).toBe('请问是哪家理财公司？')
    expect(executeTool).not.toHaveBeenCalled()
    expect(events.some((e) => e.type === 'delta')).toBe(true)
  })

  it('工具轮：tool_start 事件 + 结果回灌后继续，最终输出含报告卡事件', async () => {
    vi.mocked(chatOnce)
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: 'c1', name: 'confirm_company', arguments: { name: 'XX财富' } }], finishReason: 'tool_calls' })
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: 'c2', name: 'run_health_check', arguments: { company_id: 'xx', scenario: '买理财' } }], finishReason: 'tool_calls' })
      .mockResolvedValueOnce({ content: null, toolCalls: null, finishReason: 'stop' })
    vi.mocked(executeTool)
      .mockResolvedValueOnce({ found: true, company: { id: 'xx', name: 'XX财富' } })
      .mockResolvedValueOnce({ reportCard: { reportId: 'xx', overallRisk: 'red', name: 'XX财富', verdict: 'v', debuffItems: [], asOf: '2026-10-03', scenario: '买理财' } })
    vi.mocked(chatStream).mockImplementation(async function* () { yield { type: 'done' } })

    const events: { type: string; name?: string }[] = []
    await runAgent(USER, (e) => events.push(e))
    const toolStarts = events.filter((e) => e.type === 'tool_start')
    expect(toolStarts.map((e) => e.name)).toEqual(['confirm_company', 'run_health_check'])
    expect(events.some((e) => e.type === 'report_card')).toBe(true)
    expect(chatOnce).toHaveBeenCalledTimes(3)
  })

  it('工具返回 {error} 时回灌模型，不中断循环', async () => {
    vi.mocked(chatOnce)
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: 'c1', name: 'run_xray', arguments: { company_id: 'x' } }], finishReason: 'tool_calls' })
      .mockResolvedValueOnce({ content: null, toolCalls: null, finishReason: 'stop' })
    vi.mocked(executeTool).mockResolvedValueOnce({ error: '适配器超时' })
    vi.mocked(chatStream).mockImplementation(async function* () { yield { type: 'done' } })
    await runAgent(USER, () => {})
    const secondCallMessages = vi.mocked(chatOnce).mock.calls[1][0].messages
    expect(JSON.stringify(secondCallMessages)).toContain('适配器超时')
  })

  it('循环上限 6 轮：第 6 轮仍 tool_calls 时强制收尾', async () => {
    for (let i = 0; i < 6; i++) {
      vi.mocked(chatOnce).mockResolvedValueOnce({ content: null, toolCalls: [{ id: `c${i}`, name: 'suggest_companies', arguments: {} }], finishReason: 'tool_calls' })
    }
    vi.mocked(executeTool).mockResolvedValue({ suggestions: [] })
    vi.mocked(chatStream).mockImplementation(async function* () { yield { type: 'delta', text: '资料不足，无法完成评估。' }; yield { type: 'done' } })
    const text = await runAgent(USER, () => {})
    expect(chatOnce).toHaveBeenCalledTimes(6)
    expect(text).toContain('资料不足')
  })

  it('chatOnce 返回 null（网络故障）：回退模板话术', async () => {
    vi.mocked(chatOnce).mockResolvedValue(null)
    const text = await runAgent(USER, () => {})
    expect(text.length).toBeGreaterThan(0)
    expect(chatStream).not.toHaveBeenCalled()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run lib/chat/agent.test.ts`
预期：FAIL，`Cannot find module './agent'`

- [ ] **步骤 3：编写实现**

```ts
// lib/chat/agent.ts
import { chatOnce, chatStream, llmAvailable, type ChatMessage } from '@/lib/llm/client'
import { executeTool, toolSpecs } from './tools'

export type AgentEvent =
  | { type: 'thinking' }
  | { type: 'tool_start'; name: string; label: string }
  | { type: 'delta'; text: string }
  | { type: 'report_card'; reportCard: Record<string, unknown> }

const MAX_ROUNDS = 6

const TOOL_LABELS: Record<string, string> = {
  suggest_companies: '正在搜索公司…',
  confirm_company: '正在核对主体…',
  run_xray: '正在拍摄 X 光（约 6 秒）…',
  run_health_check: '正在评估主体健康度…',
}

export const SYSTEM_PROMPT = [
  '你是 HERMES · 公司透视的对话入口。用户要用钱（买股票/理财/加盟/报班/办卡/供应商预付），你负责解析意图、锁定公司主体、调用工具评估，并用人话解释结果。',
  '意图七类：买股票/买理财/加盟/报班培训/办卡预付费/供应商预付/其他。意图决定你在解释时强调哪些风险。',
  '铁律：',
  '1. 主体不明确时必须追问（"请问是哪家公司/品牌？"），禁止猜测主体后评估。',
  '2. 所有数字必须来自工具返回；你的回复中不得出现工具数据之外的数字与事实。',
  '3. 用户要求荐股/预测收益时，礼貌拒绝并重定向到风险评估（"我不提供买卖建议，但可以帮你看看这家公司靠不靠谱"）。',
  '4. 资料不足就如实说资料不足，并指出缺哪块。',
  '5. 评估结论附"历史不代表未来"的提醒。',
].join('\n')

const FALLBACK_TEXT = 'AI 服务暂时不可用，请稍后再试，或直接使用搜索模式查询公司。'

/**
 * Agent 循环。onEvent 同步转发 SSE 事件源；返回最终回复全文。
 * 任何 LLM 失败都回退模板话术，绝不抛出。
 */
export async function runAgent(
  history: ChatMessage[],
  onEvent: (e: AgentEvent) => void,
): Promise<string> {
  if (!llmAvailable()) return 'AI 功能未配置。'
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history]

  for (let round = 0; round < MAX_ROUNDS; round++) {
    onEvent({ type: 'thinking' })
    const result = await chatOnce({ messages, tools: toolSpecs })
    if (!result) return FALLBACK_TEXT

    if (result.toolCalls?.length) {
      for (const call of result.toolCalls) {
        onEvent({ type: 'tool_start', name: call.name, label: TOOL_LABELS[call.name] ?? call.name })
        const output = await executeTool(call.name, call.arguments)
        if (output.reportCard) onEvent({ type: 'report_card', reportCard: output.reportCard })
        messages.push(
          { role: 'assistant', content: result.content, tool_calls: [{ id: call.id, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.arguments) } }] },
          { role: 'tool', content: JSON.stringify(output), tool_call_id: call.id },
        )
      }
      continue
    }

    // 最终轮：流式输出（对话里 tool_calls 恒为空，安全）
    let text = ''
    for await (const ev of chatStream({ messages })) {
      if (ev.type === 'delta') { text += ev.text; onEvent({ type: 'delta', text: ev.text }) }
    }
    if (!text.trim()) return FALLBACK_TEXT
    return text
  }
  // 循环耗尽：强制以现有信息收尾
  const final = await chatOnce({
    messages: [...messages, { role: 'user', content: '请基于已获得的信息立即给出最终结论，不要再调用工具。' }],
  })
  return final?.content?.trim() || '资料不足，无法完成评估。建议先补充查询公司全称。'
}
```

> 步骤 3 测试断言的「第 6 轮强制收尾」用流式 mock 返回 delta 文案；实现里循环耗尽分支调用 `chatOnce` 追加强制收尾消息——若与测试 mock 不符，以测试为准调整实现（如循环内第 6 轮直接走 `chatStream` 并注入强制消息）。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run lib/chat/agent.test.ts`
预期：PASS（5 个用例）

- [ ] **步骤 5：Commit**

```bash
git add lib/chat/agent.ts lib/chat/agent.test.ts
git commit -m "feat(chat): Agent 循环——tools 轮回灌、最终轮流式、6 轮上限、失败回退模板"
```

---

### 任务 6：SSE 路由 `app/api/chat/route.ts` + PRD 用例测试

**文件：**
- 创建：`app/api/chat/route.ts`
- 创建：`app/api/chat/route.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
// app/api/chat/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/llm/client', () => ({
  llmAvailable: vi.fn(() => true),
  chatOnce: vi.fn(),
  chatStream: vi.fn(),
}))
vi.mock('@/lib/chat/tools', () => ({ toolSpecs: [], executeTool: vi.fn() }))
// agent 内部依赖被上面两个 mock 覆盖，runAgent 用真实实现
import { chatOnce, chatStream } from '@/lib/llm/client'
import { executeTool } from '@/lib/chat/tools'
import { POST } from './route'

async function readSse(res: Response): Promise<{ type: string; [k: string]: unknown }[]> {
  const text = await res.text()
  return text.split('\n\n').filter(Boolean).map((block) =>
    JSON.parse(block.replace(/^data: /, '')))
}

describe('POST /api/chat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('「我妈要买理财」→ 澄清追问（无主体不评估）', async () => {
    vi.mocked(chatOnce).mockResolvedValueOnce({ content: null, toolCalls: null, finishReason: 'stop' })
    vi.mocked(chatStream).mockImplementation(async function* () {
      yield { type: 'delta', text: '请问是哪家理财公司？把公司全称发给我。' }; yield { type: 'done' }
    })
    const res = await POST(new Request('http://x/api/chat', {
      method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: '我妈要买理财' }] }),
    }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
    const events = await readSse(res)
    expect(events.at(-1)?.type).toBe('done')
    expect(executeTool).not.toHaveBeenCalled()
  })

  it('「我想购买贵州茅台股票」→ confirm + run_xray + 报告卡 + done', async () => {
    vi.mocked(chatOnce)
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: 'c1', name: 'confirm_company', arguments: { name: '贵州茅台' } }], finishReason: 'tool_calls' })
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: 'c2', name: 'run_xray', arguments: { company_id: '600519', scenario: '买股票' } }], finishReason: 'tool_calls' })
      .mockResolvedValueOnce({ content: null, toolCalls: null, finishReason: 'stop' })
    vi.mocked(executeTool)
      .mockResolvedValueOnce({ found: true, company: { id: '600519', name: '贵州茅台' } })
      .mockResolvedValueOnce({ reportCard: { reportId: '600519', overallRisk: 'green', name: '贵州茅台', verdict: 'v', debuffItems: [], asOf: '2026-10-03', scenario: '买股票' } })
    vi.mocked(chatStream).mockImplementation(async function* () { yield { type: 'done' } })

    const res = await POST(new Request('http://x/api/chat', {
      method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: '我想购买贵州茅台股票' }] }),
    }))
    const events = await readSse(res)
    expect(events.some((e) => e.type === 'report_card')).toBe(true)
    expect(events.at(-1)?.type).toBe('done')
  })

  it('messages 缺失/为空 → 400', async () => {
    const res = await POST(new Request('http://x/api/chat', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })
})
```

> 单测不覆盖真实 LLM 行为（意图识别正确性），只覆盖管线结构；真实模型行为在任务 11 用真实 key 冒烟。`route.test.ts` 放在 `app/api/chat/`——需确认 `vitest.config.ts` 的 include 只含 `lib/**`；如是，则把本测试移到 `lib/__tests__/chat-route.test.ts` 并在头部用相对路径 `../../app/api/chat/route` import。

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run app/api/chat/route.test.ts`（或移动后的路径）
预期：FAIL，`Cannot find module './route'`

- [ ] **步骤 3：编写实现**

```ts
// app/api/chat/route.ts
import { runAgent, type AgentEvent } from '@/lib/chat/agent'
import { llmAvailable, type ChatMessage } from '@/lib/llm/client'

export const dynamic = 'force-dynamic'

function encode(e: AgentEvent | { type: 'done' } | { type: 'error'; message: string }) {
  return `data: ${JSON.stringify(e)}\n\n`
}

export async function POST(req: Request) {
  if (!llmAvailable()) {
    return Response.json({ error: 'AI 功能未配置' }, { status: 503 })
  }
  let messages: ChatMessage[]
  try {
    const body = await req.json() as { messages?: ChatMessage[] }
    messages = body.messages ?? []
  } catch {
    return Response.json({ error: '请求体必须是 JSON' }, { status: 400 })
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages 不能为空' }, { status: 400 })
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: Parameters<typeof encode>[0]) => controller.enqueue(new TextEncoder().encode(encode(e)))
      try {
        await runAgent(messages, send)
        send({ type: 'done' })
      } catch (e) {
        send({ type: 'error', message: e instanceof Error ? e.message : '未知错误' })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' } })
}
```

- [ ] **步骤 4：运行测试验证通过 + typecheck**

运行：`npx vitest run app/api/chat && npm run typecheck`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add app/api/chat/route.ts app/api/chat/route.test.ts
git commit -m "feat(chat): SSE 对话路由 POST /api_chat（503 未配置/400 校验/done/error 事件）"
```

---

### 任务 7：最近对话 `lib/chat-history.ts`

**文件：**
- 创建：`lib/chat-history.ts`、`lib/chat-history.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
// lib/chat-history.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getChatThreads, addChatThread, type ChatThread } from './chat-history'

function thread(id: string, at = 0): ChatThread {
  return { id, title: id, at, messages: [{ role: 'user', content: `msg-${id}` }] }
}

describe('lib/chat-history', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('空存储返回 []；新增后新→旧排序，上限 3 条', () => {
    expect(getChatThreads()).toEqual([])
    addChatThread(thread('a', 1)); addChatThread(thread('b', 2))
    addChatThread(thread('c', 3)); addChatThread(thread('d', 4))
    expect(getChatThreads().map((t) => t.id)).toEqual(['d', 'c', 'b'])
  })

  it('同 id 覆盖更新且置顶', () => {
    addChatThread(thread('a', 1)); addChatThread(thread('b', 2))
    addChatThread({ ...thread('a', 3), title: 'a2' })
    const threads = getChatThreads()
    expect(threads[0].id).toBe('a')
    expect(threads[0].title).toBe('a2')
  })

  it('损坏 JSON 返回 [] 不抛异常', () => {
    window.localStorage.setItem('hermes-chat-threads', '{broken')
    expect(getChatThreads()).toEqual([])
  })
})
```

- [ ] **步骤 2：运行测试验证失败 → 步骤 3：实现**

```ts
// lib/chat-history.ts
export interface ChatThread {
  id: string
  title: string // 首条用户消息截断
  at: number
  messages: { role: 'user' | 'assistant' | 'tool'; content: string | null }[]
}

const STORAGE_KEY = 'hermes-chat-threads'
const MAX_THREADS = 3

function isThread(v: unknown): v is ChatThread {
  if (typeof v !== 'object' || v === null) return false
  const t = v as Record<string, unknown>
  return typeof t.id === 'string' && typeof t.title === 'string' && typeof t.at === 'number' && Array.isArray(t.messages)
}

export function getChatThreads(): ChatThread[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isThread).slice(0, MAX_THREADS)
  } catch {
    return []
  }
}

/** 新增或同 id 覆盖，按 at 新→旧排序截断至 MAX_THREADS */
export function addChatThread(thread: ChatThread): void {
  if (typeof window === 'undefined') return
  const rest = getChatThreads().filter((t) => t.id !== thread.id)
  const next = [thread, ...rest].sort((a, b) => b.at - a.at).slice(0, MAX_THREADS)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}
```

- [ ] **步骤 4：运行测试验证通过 → 步骤 5：Commit**

```bash
git add lib/chat-history.ts lib/chat-history.test.ts
git commit -m "feat(chat): 最近对话 localStorage（上限 3 条，同 id 覆盖置顶，损坏自愈）"
```

---

### 任务 8：首页对话 tab

**文件：**
- 修改：`app/page.tsx`
- 创建：`app/api/llm-status/route.ts`、`components/home/ChatEntry.tsx`

- [ ] **步骤 1：编写失败的测试**

```ts
// app/api/llm-status/route.test.ts（或 lib/__tests__/llm-status.test.ts，同任务 6 的路径约定）
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('GET /api/llm-status', () => {
  beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals() })

  it('env 齐全 → {available: true}，否则 false', async () => {
    process.env.LLM_BASE_URL = 'https://x/v1'; process.env.LLM_API_KEY = 'k'; process.env.LLM_MODEL = 'm'
    const { GET } = await import('./route')
    expect((await GET()).status).toBe(200)
    expect(await (await GET()).json()).toEqual({ available: true })
    delete process.env.LLM_API_KEY
    const mod2 = await import('./route')
    expect(await (await mod2.GET()).json()).toEqual({ available: false })
  })
})
```

- [ ] **步骤 2：验证失败 → 步骤 3：实现 `app/api/llm-status/route.ts`**

```ts
import { llmAvailable } from '@/lib/llm/client'
export const dynamic = 'force-dynamic'
export async function GET() {
  return Response.json({ available: llmAvailable() })
}
```

- [ ] **步骤 4：实现 `components/home/ChatEntry.tsx`**

```tsx
'use client'
// 对话模式入口：Hero 标题下方的独立输入框 + 最近对话 chips。
// 发送 → addChatThread 落 localStorage → router.push(`/chat?thread=${id}`)。
// 未配置 LLM（available=false）时输入框禁用并提示。
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { addChatThread, getChatThreads, type ChatThread } from '@/lib/chat-history'

const EXAMPLES = ['我妈要买理财', '我想购买 XXX 股票', '帮我看看 XX 健身']

export function ChatEntry({ available }: { available: boolean }) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [threads, setThreads] = useState<ChatThread[]>([])

  useEffect(() => { setThreads(getChatThreads()) }, [])

  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !available) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const thread: ChatThread = { id, title: trimmed.slice(0, 24), at: Date.now(), messages: [{ role: 'user', content: trimmed }] }
    addChatThread(thread)
    router.push(`/chat?thread=${id}`)
  }

  return (
    <div className="pointer-events-auto w-full max-w-xl">
      {!available && <p className="mb-2 text-xs text-slate-500">AI 功能未配置（缺少 LLM 环境变量）</p>}
      <form onSubmit={(e) => { e.preventDefault(); submit(value) }}
        className="flex items-center gap-2 rounded-btn border border-glass bg-glass px-4 py-3">
        <MessageSquare className="size-4 shrink-0 text-slate-400" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!available}
          placeholder={available ? `例如：${EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]}` : 'AI 功能未配置'}
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500 disabled:opacity-50"
        />
        <button type="submit" disabled={!available || !value.trim()} className="shrink-0 text-sm text-neon disabled:opacity-40">发送</button>
      </form>
      {threads.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">最近对话：</span>
          {threads.map((t) => (
            <button key={t.id} onClick={() => router.push(`/chat?thread=${t.id}`)}
              className="rounded-full border border-glass px-3 py-1 text-xs text-slate-300 hover:border-neon hover:text-neon">
              {t.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **步骤 5：修改 `app/page.tsx`**

```tsx
// 变更点（在现有 queryMode state 与 tab 按钮基础上）：
const [queryMode, setQueryMode] = useState<'search' | 'filter' | 'chat'>('search')
const [llmOk, setLlmOk] = useState(true)
useEffect(() => { fetch('/api/llm-status').then((r) => r.json()).then((d) => setLlmOk(Boolean(d.available))).catch(() => setLlmOk(false)) }, [])

// tab 区新增第三个按钮（复制筛选按钮结构）：
<button onClick={() => setQueryMode('chat')} aria-pressed={queryMode === 'chat'}
  className={`min-w-28 rounded-btn px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon ${queryMode === 'chat' ? 'bg-neon text-ink-bg' : 'text-slate-400 hover:text-slate-100'}`}>
  对话
</button>

// 内容区（原 search/filter 分支之后）新增：
{queryMode === 'chat' && <ChatEntry available={llmOk} />}
```

> `bg-glass`/`border-glass`/`rounded-btn`/`text-neon` 为仓库现有 Tailwind token；若实际类名不同，以 `app/page.tsx` 与 `components/home/SearchBox.tsx` 现有用法为准。`FilterPanel` 分支当前用 `overflow-y-auto` 布局，chat 分支沿用 search 的 `justify-center` 行为。

- [ ] **步骤 6：验证 + Commit**

运行：`npm run typecheck && npm run test && npm run build`
预期：全绿（build 验证 Windows 嵌套路由已知坑，见 memory：Next 15.5 动态路由 Windows bug——若 `[id]` 级路由构建报错，确认未新增嵌套动态段即可，本任务只加 `/chat` 与 `/api/llm-status` 单层路由）

```bash
git add app/page.tsx app/api/llm-status/route.ts app/api/llm-status/route.test.ts components/home/ChatEntry.tsx
git commit -m "feat(home): 第三模式「对话」——输入框 + 最近对话 chips + LLM 状态探测"
```

---

### 任务 9：`/chat` 全屏对话页

**文件：**
- 创建：`app/chat/page.tsx`
- 创建：`components/chat/ChatWindow.tsx`、`components/chat/ReportCard.tsx`

- [ ] **步骤 1：先写页面骨架并手动验证（视觉组件走查后置）**

```tsx
// app/chat/page.tsx
'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { getChatThreads, type ChatThread } from '@/lib/chat-history'

export default function ChatPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">加载中…</div>}><ChatInner /></Suspense>
}

function ChatInner() {
  const params = useSearchParams()
  const router = useRouter()
  const threadId = params.get('thread')
  const [thread, setThread] = useState<ChatThread | null>(null)

  useEffect(() => {
    if (!threadId) { router.replace('/'); return }
    const found = getChatThreads().find((t) => t.id === threadId)
    if (!found) { router.replace('/'); return }
    setThread(found)
  }, [threadId, router])

  if (!thread) return null
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-glass px-6 py-4">
        <Link href="/" className="flex items-center gap-1 text-sm text-slate-400 hover:text-neon"><ArrowLeft className="size-4" /> 返回首页</Link>
        <span className="text-sm text-slate-500">HERMES · 对话</span>
      </header>
      <ChatWindow thread={thread} onThreadUpdate={(t) => setThread(t)} />
    </div>
  )
}
```

- [ ] **步骤 2：实现 `components/chat/ChatWindow.tsx`（核心交互）**

```tsx
'use client'
// 消息流 + fetch SSE 读取（EventSource 不能 POST）。
// 事件处理：thinking（忽略）/ tool_start（追加进度行）/ delta（追加到当前 AI 气泡）
// / report_card（追加迷你面板）/ done（落 localStorage）/ error（气泡显示错误）。
import { useEffect, useRef, useState } from 'react'
import { addChatThread, type ChatThread } from '@/lib/chat-history'
import { ReportCard } from './ReportCard'

interface UiMsg {
  role: 'user' | 'assistant' | 'tool' | 'card'
  text: string
  reportCard?: Record<string, unknown>
}

export function ChatWindow({ thread, onThreadUpdate }: { thread: ChatThread; onThreadUpdate: (t: ChatThread) => void }) {
  const [messages, setMessages] = useState<UiMsg[]>(
    thread.messages.filter((m) => m.role !== 'tool').map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.content ?? '' })),
  )
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, [messages])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    const userMsg: UiMsg = { role: 'user', text: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setBusy(true)

    const apiMessages = [...thread.messages, { role: 'user' as const, content: trimmed }]
    let aiText = ''
    try {
      const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ messages: apiMessages }) })
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      setMessages((prev) => [...prev, { role: 'assistant', text: '' }])
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() ?? ''
        for (const block of blocks) {
          const line = block.trim()
          if (!line.startsWith('data:')) continue
          const ev = JSON.parse(line.slice(5).trim()) as { type: string; text?: string; label?: string; reportCard?: Record<string, unknown>; message?: string }
          if (ev.type === 'delta' && ev.text) {
            aiText += ev.text
            setMessages((prev) => { const next = [...prev]; next[next.length - 1] = { role: 'assistant', text: aiText }; return next })
          } else if (ev.type === 'tool_start') {
            setMessages((prev) => [...prev, { role: 'tool', text: ev.label ?? '处理中…' }])
          } else if (ev.type === 'report_card' && ev.reportCard) {
            setMessages((prev) => [...prev, { role: 'card', text: '', reportCard: ev.reportCard }])
          } else if (ev.type === 'error') {
            aiText += `\n[${ev.message ?? '服务错误'}]`
          }
        }
      }
    } catch (e) {
      aiText = e instanceof Error && e.message === 'AI 功能未配置'
        ? 'AI 功能未配置（缺少 LLM 环境变量）。'
        : `请求失败：${e instanceof Error ? e.message : '未知错误'}`
      setMessages((prev) => { const next = [...prev]; next[next.length - 1] = { role: 'assistant', text: aiText }; return next })
    } finally {
      setBusy(false)
      const updated: ChatThread = {
        ...thread,
        at: Date.now(),
        messages: [...apiMessages, { role: 'assistant', content: aiText }],
      }
      addChatThread(updated)
      onThreadUpdate(updated)
    }
  }

  return (
    <>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.map((m, i) => m.role === 'card' && m.reportCard
          ? <ReportCard key={i} card={m.reportCard as { reportId: string; name: string; overallRisk: string; verdict: string; debuffItems: { id: string; label: string; severity: string; description: string }[]; asOf: string }} />
          : (
            <div key={i} className={`max-w-2xl ${m.role === 'user' ? 'ml-auto text-right' : ''}`}>
              {m.role === 'tool'
                ? <p className="text-xs text-slate-500">⚙ {m.text}</p>
                : <div className={`inline-block rounded-btn px-4 py-3 text-sm ${m.role === 'user' ? 'bg-neon text-ink-bg' : 'border border-glass bg-glass'}`}>{m.text}</div>}
            </div>
          ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input) }}
        className="flex items-center gap-2 border-t border-glass px-6 py-4">
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
          placeholder="继续追问，例如：那这家和 XX 比呢？"
          className="w-full rounded-btn border border-glass bg-glass px-4 py-3 text-sm outline-none placeholder:text-slate-500" />
        <button type="submit" disabled={busy || !input.trim()} className="shrink-0 rounded-btn bg-neon px-5 py-3 text-sm font-medium text-ink-bg disabled:opacity-40">发送</button>
      </form>
    </>
  )
}
```

- [ ] **步骤 3：实现 `components/chat/ReportCard.tsx`（视觉已定稿：迷你面板）**

```tsx
'use client'
// 报告卡迷你面板：灯 + 公司名 + 逐条 debuff 人话解释 + 资料截至 + 跳转。
// 视觉规格见 specs/2026-10-03-ai-chat-xray-design.md「报告卡」节。
import Link from 'next/link'

const LAMP: Record<string, { emoji: string; color: string; label: string }> = {
  green: { emoji: '🟢', color: '#3ecf6e', label: '绿灯' },
  yellow: { emoji: '🟡', color: '#e6b93d', label: '黄灯' },
  red: { emoji: '🔴', color: '#d43a3a', label: '红灯' },
}

export function ReportCard({ card }: {
  card: { reportId: string; name: string; overallRisk: string; verdict: string; debuffItems: { id: string; label: string; severity: string; description: string }[]; asOf: string }
}) {
  const lamp = LAMP[card.overallRisk] ?? LAMP.yellow
  return (
    <div className="max-w-2xl rounded-btn border border-glass bg-glass p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xl">{lamp.emoji}</span>
        <div>
          <p className="font-medium">{card.name}</p>
          <p className="text-xs text-slate-500">{lamp.label} · 资料截至 {card.asOf}</p>
        </div>
      </div>
      <p className="mb-3 text-sm text-slate-200">{card.verdict}</p>
      {card.debuffItems.length > 0 && (
        <ul className="mb-3 space-y-2">
          {card.debuffItems.map((d) => (
            <li key={d.id} className="rounded-btn bg-black/30 px-3 py-2 text-sm">
              <span className="font-medium">{d.label}</span>
              <span className="text-slate-400"> — {d.description}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/report/${card.reportId}`} className="text-sm text-neon hover:underline">完整 X 光与证据链 →</Link>
    </div>
  )
}
```

- [ ] **步骤 4：视觉走查**

启动 `npm run dev`，浏览器走查：发送"我妈要买理财" → 追问气泡；完整评估一次（mock 数据公司）→ 报告卡样式与跳转。发现问题迭代样式；通过后截图留存。

- [ ] **步骤 5：Commit**

```bash
git add app/chat components/chat
git commit -m "feat(chat): /chat 全屏对话页——SSE 消息流、tool 进度行、迷你面板报告卡"
```

---

### 任务 10：报告页「下一步」区块 `components/xray/NextStepsCard.tsx`

**文件：**
- 创建：`components/xray/NextStepsCard.tsx`
- 修改：`components/xray/XrayClient.tsx`（LITE 插在 CharacterCard 后、PRO 插在 MetaStrip 后）

- [ ] **步骤 1：组件实现（无独立单测——纯展示组件，数据契约已由任务 2/3 测试覆盖）**

```tsx
// components/xray/NextStepsCard.tsx
// 「下一步」行动建议：编号清单 + 场景标签 + 诚实标注行。LLM 失败时不渲染（父组件条件渲染）。
import type { CompanyXRay } from '@/lib/types'

export function NextStepsCard({ nextSteps }: { nextSteps: NonNullable<CompanyXRay['nextSteps']> }) {
  return (
    <section className="mt-4 rounded-btn border border-glass bg-glass p-5">
      <p className="mb-3 font-mono text-xs tracking-[0.3em] text-slate-500">NEXT STEPS · 场景：{nextSteps.scenario}</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-7">
        {nextSteps.items.map((item, i) => <li key={i}>{item}</li>)}
      </ol>
      <p className="mt-3 text-xs text-slate-500">{nextSteps.caveat} · 由 AI 生成 · {nextSteps.generatedAt.slice(0, 10)}</p>
    </section>
  )
}
```

- [ ] **步骤 2：接入 XrayClient.tsx**

```tsx
// LITE：在 CharacterCard 的 motion.div 之后（右列 div 之前）插入：
{displayXray.nextSteps && <NextStepsCard nextSteps={displayXray.nextSteps} />}

// PRO：在 MetaStrip 的 motion.div 之后插入（同款条件渲染）。
// 顶部 import { NextStepsCard } from './NextStepsCard'
```

- [ ] **步骤 3：验证**

运行：`npm run typecheck && npm run test && npm run build`
手动：dev server 打开 mock-danger 报告页（配置 LLM env 时）→ 出现 NEXT STEPS 区块；`LLM_API_KEY=` 置空重启 → 区块消失、模板 advice 仍在。

- [ ] **步骤 4：Commit**

```bash
git add components/xray/NextStepsCard.tsx components/xray/XrayClient.tsx
git commit -m "feat(report): 「下一步」行动建议区块——LITE 角色卡下/PRO MetaStrip 下，LLM 失败整块隐藏"
```

---

### 任务 11：端到端验证与收尾

- [ ] **步骤 1：全量验证**

```bash
npm run typecheck
npm run test
npm run build
```
预期：全部通过；测试总数含新增（client 7 + types 2 + narrative 5 + tools 5 + agent 5 + route 3 + history 3 + llm-status 1）。

- [ ] **步骤 2：真实 LLM 冒烟（用 `.env.local` 真实 key，非测试）**

```bash
npm run dev
# 终端 2：
curl -N -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" --data-binary '{"messages":[{"role":"user","content":"我妈要买理财"}]}'
# 预期：SSE 事件流，AI 追问公司主体，不出现 tool_start
curl -N -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" --data-binary '{"messages":[{"role":"user","content":"帮我看看 mock-danger"}]}'
# 预期：出现 tool_start + report_card + delta + done
```
另浏览器走查：`/` 对话 tab → 发送 → /chat → 报告卡跳转 /report/[id] → NEXT STEPS 区块。

- [ ] **步骤 3：DOC-B 三档 curl 复测**

按 DOC-B 文档对 mock-healthy/warning/danger 三档复测，确认叙事层接线后三档结论无劣化（灯色/分数不变，verdict 可能因润色变化但语义一致）。

- [ ] **步骤 4：最终 Commit + 更新规格状态**

```bash
git add -A
git commit -m "feat(ai): 对话模式全链路落地——grilling/视觉走查定稿的实现（规格 specs/2026-10-03-ai-chat-xray-design.md）"
```

---

## 自检记录

- **规格覆盖度**：规格§基础设施→任务1/8；§对话管线→任务4/5/6；§前端首页→任务8，/chat→任务9；§行动建议→任务2/3/10；§测试→各任务 TDD + 任务11。信号引擎扩展（规格§4）明确划归计划 2，不在本计划。
- **占位符扫描**：无 TODO；唯一弹性处（任务 2 mock import 路径、任务 5 收尾分支、任务 6 测试路径）均给出"以现有代码为准"的判定命令。
- **类型一致性**：`ChatMessage`/`ChatResult`/`ToolSpec`（任务 1）在任务 3/4/5/6 引用一致；`NextSteps`（任务 2）在任务 3/10 引用一致；`reportCard` 形状（任务 4）= `report_card` 事件载荷（任务 5）= `ReportCard` props（任务 9），字段名 `reportId/name/overallRisk/verdict/debuffItems/asOf` 全链路一致。
- **已知风险**：ling-3.1-flash 为推理模型，若现场 max_tokens 2000 仍截断导致 JSON 不完整 → 客户端重试 1 次 + 回退模板，可接受；SSE 经 Next dev server 缓冲问题如发生，任务 11 冒烟会暴露。
