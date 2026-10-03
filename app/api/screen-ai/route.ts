// POST /api/screen-ai — 自然语言 → ScreeningRequest 翻译（LLM JSON 模式）
// 用户大白话（「帮我找负债率低、现金流好的制造业上市公司」）→ 结构化筛选参数，
// 前端拿到后回填 FilterPanel（可见可改），再走 /api/screen。
// LLM 不可用/翻译失败 → 503/422，前端回退关键词搜索。
import { chatOnce, llmAvailable } from '@/lib/llm/client'
import { isScreeningRequest, type ScreeningRequest } from '@/lib/screening'

export const dynamic = 'force-dynamic'

const SYSTEM = `你是筛选条件翻译器。把用户的自然语言需求翻译成一个 JSON 筛选请求，只输出 JSON，不要任何其他文字。

输出格式（严格遵循）：
{
  "discovery": { "keyword": string, "region": string, "industry": ""|"manufacturing"|"technology"|"consumer"|"healthcare"|"finance"|"energy"|"realestate", "listing": ""|"listed"|"unlisted" },
  "mode": "lite" | "pro",
  "filters": { ... }
}

- mode 为 "pro" 时 filters 用 ProFilters：revenueGrowth/netMargin/debtRatio/currentRatio/pledgeRatio/lawsuitCount（字符串数字或""）、positiveCashFlow/noExecution（boolean）
- mode 为 "lite" 时 filters 用 LiteFilters：budget/targetReturn/risk(""|"low"|"medium"|"high")/horizon/liquidity（字符串）、avoidLoss/avoidLawsuits/avoidPledge（boolean）
- 不确定的字段留空字符串或 false，禁止编造具体数值
- 只输出能被以下枚举约束的值；超出范围的值宁可留空

示例：
用户：「找负债率低于 50% 的制造业上市公司」
输出：{"discovery":{"keyword":"","region":"","industry":"manufacturing","listing":"listed"},"mode":"pro","filters":{"revenueGrowth":"","netMargin":"","debtRatio":"50","currentRatio":"","pledgeRatio":"","lawsuitCount":"","positiveCashFlow":false,"noExecution":false}}`

export async function POST(req: Request) {
  if (!llmAvailable()) {
    return Response.json({ error: 'llm_not_configured' }, { status: 503 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }
  const q = String((body as { query?: unknown })?.query ?? '').trim()
  if (!q || q.length > 200) {
    return Response.json({ error: 'query_required' }, { status: 400 })
  }

  const res = await chatOnce({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `用户需求：「${q}」` },
    ],
    scene: 'chat',
    timeoutMs: 30_000,
  })
  if (!res?.content) {
    return Response.json({ error: 'translate_failed' }, { status: 422 })
  }

  let parsed: unknown
  try {
    // 剥掉可能的代码围栏
    const cleaned = res.content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return Response.json({ error: 'translate_invalid_json' }, { status: 422 })
  }

  if (!isScreeningRequest(parsed)) {
    return Response.json({ error: 'translate_out_of_schema' }, { status: 422 })
  }

  return Response.json({ ok: true, request: parsed as ScreeningRequest })
}
