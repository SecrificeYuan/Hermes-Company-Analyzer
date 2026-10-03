import { describe, expect, it } from 'vitest'
import { analyze } from '@/lib/analysis/analyze'
import { narrativeCopy } from '@/lib/narrative-copy'
import { narrativeOf } from '@/lib/narrative'
import { scoreDefense } from '@/lib/analysis/scoring/defense'
import { scoreMorale } from '@/lib/analysis/scoring/morale'
import { scoreAttack } from '@/lib/analysis/scoring/attack'
import { healthToXray } from '@/lib/data/health-xray'
import { emptyHealth } from '@/lib/health-assessment'
import type { RawCompanyData } from '@/lib/types'

const base: RawCompanyData = {
  meta: { id: 'test', name: '测试公司', industry: '测试', fetchedAt: '2026-10-02T00:00:00Z', sources: [] },
  financial: { years: [{ year: '2025', revenue: 1000, netProfit: 100, operatingCashFlow: 100, debtRatio: 40 }] },
  people: [], legal: { lawsuits: [], executions: [], dishonest: 0 },
}
const lawsuits = (count: number, role: '原告' | '被告' = '被告') => Array.from({ length: count }, () => ({ date: '2026-09-01', amount: 10, cause: '合同纠纷', role }))

describe('按已核实状态和程度生成浅显说明', () => {
  it('零、少量、较多诉讼和原告身份使用不同说明，金额与失信有证据才提及', () => {
    const copy = (count: number, role: '原告' | '被告' = '被告') => narrativeCopy('atk', analyze({ ...base, legal: { lawsuits: lawsuits(count, role), executions: [], dishonest: 0 } }))
    expect(copy(0).big).toBe('0 起')
    expect(copy(0).text).toContain('未发现诉讼记录')
    expect(copy(2).text).toContain('原告还是被告')
    expect(copy(7).text).toContain('记录较多')
    expect(copy(2, '原告').text).toContain('维护自身权益')
    for (const count of [0, 2, 7]) expect(copy(count).text).not.toMatch(/滴血|另有被执行|另有.*失信记录/)
    const withExecution = analyze({ ...base, legal: { lawsuits: [], executions: [{ date: '2026-09-01', amount: 50, status: '未履行' }], dishonest: 1 } })
    expect(narrativeCopy('atk', withExecution).text).toContain('涉及 50万')
    expect(narrativeCopy('atk', withExecution).text).toContain('1 条失信记录')
    expect(scoreAttack({ lawsuits: [], executions: [], dishonest: 1 }).label).toBe('有司法记录')
  })

  it('质押零、较低、需关注和较高各自解释，AI 文案不能反转数据含义', () => {
    const texts = [0, 10, 45, 80].map((amount) => {
      const x = analyze({ ...base, people: [{ name: '股东', role: '股东', event: '质押', date: '2026-09-01', amount }] })
      x.llm = { summary: '', sectionNotes: { def: '押到极限，快要爆雷' }, generatedAt: '', model: 'test' }
      return narrativeCopy('def', x).text
    })
    expect(texts[0]).toContain('比例为 0%')
    expect(texts[1]).toContain('比例较低')
    expect(texts[2]).toContain('需要关注变化')
    expect(texts[3]).toContain('比例较高')
    expect(texts.join('')).not.toContain('快要爆雷')
  })

  it('中性与不同程度的正负报道不推断员工、客户的态度', () => {
    for (const [tone, description] of [[0, '接近中性'], [-1, '略偏负面'], [-5, '明显偏负面'], [1, '略偏正面'], [5, '明显偏正面']] as const) {
      const sentiment = [{ date: '2026-10-01', tone, headline: '测试报道', source: '测试新闻' }]
      const x = analyze({ ...base, sentiment })
      expect(narrativeCopy('morale', x).text).toContain(description)
      expect(scoreMorale(sentiment, new Date(base.meta.fetchedAt)).label).not.toMatch(/军心|士气|人心|流言/)
    }
  })

  it('只有质押或持股集中标记时，不宣称关联方已经被执行或失信', () => {
    const x = analyze({ ...base, people: [{ name: '股东', role: '股东', event: '质押', amount: 10, date: '2026-09-01' }], shareholders: [{ name: '机构', ratio: 45, isInstitution: true }] })
    const copy = narrativeCopy('network', x)
    expect(copy.big).toBe('2')
    expect(copy.text).toContain('质押、持股集中')
    expect(copy.text).toContain('不证明关联方被执行或失信')
    expect(copy.text).not.toContain('已经被执行')
  })
})

describe('缺失输入不能伪装零风险', () => {
  it('质押失败不再产出 DEF100 或铜墙铁壁，已核实零质押仍可评分', () => {
    const unknown = analyze({ ...base, people: undefined })
    expect(unknown.def).toMatchObject({ available: false, pledgeAvailable: false, label: '数据不足' })
    expect(unknown.def.score).not.toBe(100)
    expect(narrativeCopy('def', unknown).big).toBe('暂无法判断')
    expect(unknown.verdict).toContain('资料尚不完整')
    expect(scoreDefense({ ...base, people: [{ name: '整体', role: '股东', event: '质押', amount: 0, date: '2026-09-01' }], meta: { ...base.meta, sources: [{ name: 'eastmoney_pledge', ok: true, fallback: false, latencyMs: 0 }] } })).toMatchObject({ available: true, pledgeAvailable: true, score: 100 })
    expect(scoreDefense({ ...base, meta: { ...base.meta, sources: [{ name: 'eastmoney_pledge', ok: false, fallback: false, latencyMs: 0 }] } }).pledgeAvailable).toBe(false)
  })

  it('所有输入缺失时分数有限但不可展示为已知，四个维度均为未知', () => {
    const x = analyze({ meta: base.meta })
    expect(Number.isFinite(x.riskScore)).toBe(true)
    for (const key of ['hp', 'def', 'atk', 'morale'] as const) {
      expect(x[key].available).toBe(false)
      expect(narrativeCopy(key, x).big).toBe('暂无法判断')
    }
    expect(narrativeOf(x).type).toBe('balanced')
  })

  it('财务缺失但质押已知时，不丢失已核实的质押比例', () => {
    const x = analyze({ ...base, financial: undefined, people: [{ name: '整体', role: '股东', event: '质押', amount: 45, date: '2026-09-01' }] })
    expect(x.def.available).toBe(false)
    expect(x.def.pledgeAvailable).toBe(true)
    expect(narrativeCopy('def', x).big).toBe('45%')
    expect(narrativeCopy('hp', x).big).toBe('暂无法判断')
  })

  it('空企业健康报告不生成正面叙述，公告命中数不能变成法院案件数', () => {
    const report = emptyHealth({ id: 'web_test', name: '测试公司', listing: 'unknown', identity: 'lead', sources: [] })
    report.metrics.lawsuitAnnouncements = 2
    const x = healthToXray(report)
    for (const key of ['hp', 'def', 'atk', 'morale', 'network'] as const) expect(narrativeCopy(key, x).big).toBe('暂无法判断')
    expect(x.atk.available).toBe(false)
    expect(narrativeCopy('atk', x).text).not.toContain('2 起')
  })
})
