import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CompanyXRay } from '@/lib/types'
import { makeXray } from '@/lib/__tests__/fixtures'

// 构造危险公司基础 xray，覆写关键字段
const base = makeXray({})
const xray = {
  ...base,
  id: 'mock-danger', name: '测试危险公司', industry: '理财', overallRisk: 'red' as const,
  hp: { ...base.hp, score: 12 },
  def: { ...base.def, score: 8 },
  hiddenStatus: [{ id: 'unlicensed', label: '无牌照募资', severity: 'high' as const, description: '无金融牌照', evidence: [{ source: '快照', date: '2026-10-03', detail: '无备案' }] }],
  verdict: '模板结论', advice: '模板建议', asOf: '2026-10-03',
}

describe('lib/llm/narrative', () => {
  beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals() })

  it('buildActionAdviceMessages：system 要求 JSON、3-5 条、含场景与诚实标注铁律', async () => {
    const { buildActionAdviceMessages } = await import('./narrative')
    const msgs = buildActionAdviceMessages(xray as CompanyXRay, '买理财')
    const sys = msgs.find((m) => m.role === 'system')!.content!
    expect(sys).toContain('JSON')
    expect(sys).toContain('3 到 5')
    expect(sys).toContain('买理财')
    expect(sys).toContain('历史不代表未来')
    expect(sys).toContain('红灯')
  })

  it('parseActionAdvice：合法 JSON 且 3-5 条 → 通过并带 generatedAt/model', async () => {
    const { parseActionAdvice } = await import('./narrative')
    const raw = JSON.stringify({ scenario: '买理财', items: ['a', 'b', 'c'], caveat: '历史不代表未来' })
    const ns = parseActionAdvice(raw, 'ling-3.1-flash')
    expect(ns?.items).toHaveLength(3)
    expect(ns?.model).toBe('ling-3.1-flash')
    expect(ns?.generatedAt).toBeTruthy()
  })

  it('parseActionAdvice：条数越界/缺字段/非 JSON/空串 → null', async () => {
    const { parseActionAdvice } = await import('./narrative')
    expect(parseActionAdvice('{"scenario":"s","items":["a"]}', 'm')).toBeNull()
    expect(parseActionAdvice('{"scenario":"s","items":["a","b","c","d","e","f"]}', 'm')).toBeNull()
    expect(parseActionAdvice('{"items":["a","b","c"]}', 'm')).toBeNull()
    expect(parseActionAdvice('not json', 'm')).toBeNull()
    expect(parseActionAdvice('{"scenario":"s","items":["a","b",""]}', 'm')).toBeNull()
  })

  it('caveat 缺失时回退默认诚实标注「历史不代表未来」，不拒绝结果', async () => {
    const { parseActionAdvice } = await import('./narrative')
    const raw = JSON.stringify({ scenario: 's', items: ['a', 'b', 'c'] })
    const ns = parseActionAdvice(raw, 'm')
    expect(ns).not.toBeNull()
    expect(ns?.caveat).toBe('历史不代表未来')
  })

  it('数字可溯源守卫：条目中的百分数必须能在面板数据中找到，否则拒绝', async () => {
    const { parseActionAdvice } = await import('./narrative')
    // hp.score=12 → "12%" 可溯源，"7%" 无出处
    const okRaw = JSON.stringify({ scenario: 's', items: ['血条仅 12%，快跑', '问牌照', '托管行写入合同'] })
    expect(parseActionAdvice(okRaw, 'm', xray as CompanyXRay)?.items).toHaveLength(3)
    const badRaw = JSON.stringify({ scenario: 's', items: ['血条仅 7%，快跑', '问牌照', '托管行写入合同'] })
    expect(parseActionAdvice(badRaw, 'm', xray as CompanyXRay)).toBeNull()
  })
})
