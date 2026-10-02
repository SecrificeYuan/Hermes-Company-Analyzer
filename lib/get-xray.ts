import { analyze } from '@/lib/analysis/analyze'
import { applyVerdictRefinement } from '@/lib/analysis/verdict'
import { fetchRawCompany } from '@/lib/data/fetcher'
import { chatOnce, llmAvailable } from '@/lib/llm/client'
import { buildActionAdviceMessages, parseActionAdvice } from '@/lib/llm/narrative'
import type { CompanyXRay } from '@/lib/types'

const xrayCache = new Map<string, { data: CompanyXRay; expiresAt: number }>()
const TTL_MS = 5 * 60 * 1000

/**
 * 统一取数入口：API Route 与 Server Component 共用。
 * 前端 HTTP 消费走 /api/company/[id]/xray；页面服务端渲染直接调本函数，免去自请求。
 *
 * scenario（可选）：用户意图场景（如「买理财」），用于生成「下一步」行动建议。
 * 不同场景的行动建议不共享缓存（缓存 key 带 scenario）。
 */
export async function getXRay(id: string, scenario?: string): Promise<CompanyXRay> {
  const cacheKey = `${id}::${scenario ?? ''}`
  const hit = xrayCache.get(cacheKey)
  if (hit && Date.now() < hit.expiresAt) return hit.data

  const raw = await fetchRawCompany(id)
  const xray = analyze(raw)
  await enrichWithNarrative(xray, scenario)
  xrayCache.set(cacheKey, { data: xray, expiresAt: Date.now() + TTL_MS })
  return xray
}

/**
 * 叙事层接线：verdict 润色 + 场景行动建议（NextSteps）。
 * 任何 LLM 失败/超时/守卫不通过都静默回退模板结果，绝不影响报告页出数。
 */
async function enrichWithNarrative(xray: CompanyXRay, scenario?: string): Promise<void> {
  if (!llmAvailable()) return
  try {
    const verdictJob = (async () => {
      const res = await chatOnce({
        messages: [
          {
            role: 'system',
            content:
              '你是严谨的金融风险提示助手。只输出一个 JSON 对象 {"verdict": string, "advice": string, "overallRisk": "green"|"yellow"|"red"}，不要输出任何其他文字。必须原样返回输入中的 overallRisk，不得改变风险结论；不得编造输入数据之外的数字。',
          },
          {
            role: 'user',
            content: JSON.stringify({
              模板结论: xray.verdict,
              模板建议: xray.advice,
              overallRisk: xray.overallRisk,
              命中信号: xray.hiddenStatus.map((h) => `${h.label}（${h.severity}）：${h.description}`),
            }),
          },
        ],
      })
      if (!res?.content) return
      let candidate: unknown
      try {
        candidate = JSON.parse(res.content)
      } catch {
        return // 非 JSON：保持模板
      }
      const c = candidate as { verdict?: unknown; advice?: unknown; overallRisk?: unknown }
      if (typeof c.verdict !== 'string' || typeof c.advice !== 'string') return
      const refined = applyVerdictRefinement(
        { verdict: xray.verdict, advice: xray.advice },
        xray.overallRisk,
        { verdict: c.verdict, advice: c.advice, overallRisk: c.overallRisk as CompanyXRay['overallRisk'] },
      )
      xray.verdict = refined.verdict
      xray.advice = refined.advice
    })()

    const stepsJob = scenario
      ? (async () => {
          const res = await chatOnce({ messages: buildActionAdviceMessages(xray, scenario) })
          if (!res?.content) return
          const ns = parseActionAdvice(res.content, process.env.LLM_MODEL ?? '', xray)
          if (ns) xray.nextSteps = ns
        })()
      : Promise.resolve()

    await Promise.allSettled([verdictJob, stepsJob])
  } catch {
    // 任何编排层异常都返回未修改的 xray
  }
}
