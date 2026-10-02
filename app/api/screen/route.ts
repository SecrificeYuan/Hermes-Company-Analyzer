import { NextRequest, NextResponse } from 'next/server'
import { discoverForScreen } from '@/lib/data/screen-discovery'
import { getCompanyHealth } from '@/lib/data/company-health'
import { evaluateMatch, isScreeningRequest, type ScreenCandidate, type ScreeningResponse } from '@/lib/screening'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  let input: unknown
  try { input = await req.json() } catch { return NextResponse.json({ error: '筛选条件格式无效' }, { status: 400 }) }
  if (!isScreeningRequest(input)) return NextResponse.json({ error: '请检查筛选条件的取值范围' }, { status: 400 })
  const discovery = await discoverForScreen(input)
  const items: ScreenCandidate[] = []
  const leads: ScreenCandidate[] = []
  let evaluated = 0
  let excluded = 0
  const candidates = discovery.suggestions.slice(0, 24)
  for (let i = 0; i < candidates.length; i += 6) {
    const batch = await Promise.allSettled(candidates.slice(i, i + 6).map(getCompanyHealth))
    for (const result of batch) {
      if (result.status !== 'fulfilled') continue
      evaluated += 1
      const match = evaluateMatch(result.value, input)
      const candidate = { ...result.value, matched: match.matched, unresolved: match.unresolved }
      if (match.status === 'matched') items.push(candidate)
      else if (match.status === 'unresolved') leads.push(candidate)
      else excluded += 1
    }
  }
  const riskOrder = { low: 0, medium: 1, high: 2 }
  items.sort((a, b) => riskOrder[a.financialRisk!] - riskOrder[b.financialRisk!] || (b.metrics.netMargin ?? -Infinity) - (a.metrics.netMargin ?? -Infinity))
  leads.sort((a, b) => a.unresolved.length - b.unresolved.length)
  const response: ScreeningResponse = {
    items: items.slice(0, 3), leads: leads.slice(0, 3), discovered: discovery.suggestions.length, evaluated, excluded,
    sources: discovery.sources, queriedAt: new Date().toISOString(),
    scope: '按本次条件实时查询公开来源，最多评估 24 家并展示 3 家已验证匹配；当前来源不是完整工商名录。',
  }
  return NextResponse.json(response)
}
