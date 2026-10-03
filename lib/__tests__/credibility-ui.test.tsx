import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { analyze } from '@/lib/analysis/analyze'
import { compareCompanyVerdict } from '@/lib/analysis/compare-verdict'
import { MetricCompareTable } from '@/components/compare/MetricCompareTable'
import { CompareVerdictBar } from '@/components/compare/CompareVerdictBar'
import { DualRadar } from '@/components/compare/DualRadar'
import { AttributeRadar } from '@/components/xray/AttributeRadar'
import { CharacterPanel } from '@/components/xray/CharacterPanel'
import { MetaStrip } from '@/components/xray/MetaStrip'
import { ShareCard } from '@/components/share/ShareCard'
import { PledgeSummary } from '@/components/xray/detail/EquitySection'
import { NarrativeCard } from '@/components/xray/NarrativeCard'
import type { EChartsOption } from 'echarts'
import type { CompanyXRay, RawCompanyData } from '@/lib/types'

const { chart } = vi.hoisted(() => ({ chart: vi.fn() }))
vi.mock('@/components/xray/EChart', () => ({ EChart: (props: { option: EChartsOption }) => { chart(props.option); return null } }))

const base: RawCompanyData = {
  meta: { id: 'test', name: '测试公司', industry: '测试', fetchedAt: '2026-10-02T00:00:00Z', sources: [] },
  financial: { years: [{ year: '2025', revenue: 1000, netProfit: 100, operatingCashFlow: 100, debtRatio: 40 }] },
  people: [], legal: { lawsuits: [], executions: [], dishonest: 0 },
  sentiment: [{ date: '2026-10-01', tone: 0, headline: '测试报道', source: '测试新闻' }],
}
function dom(element: React.ReactElement) {
  const div = document.createElement('div')
  div.innerHTML = renderToStaticMarkup(element)
  return div
}
function row(root: HTMLElement, label: string) {
  return Array.from(root.querySelectorAll('tbody tr')).find((r) => r.firstElementChild?.textContent === label)!
}
function values(option: EChartsOption): (number | string)[][] {
  return (option.series as { data: { value: (number | string)[] }[] }[])[0].data.map((data) => data.value)
}

describe('对比页保留未知状态', () => {
  it('两家司法均缺失时，不能把 0/50 占位当作平局或差值零', () => {
    const x = analyze({ ...base, legal: undefined })
    const table = dom(<MetricCompareTable a={x} b={x} />)
    for (const label of ['诉讼数量', '被执行金额', '综合风险分']) {
      expect(Array.from(row(table, label).querySelectorAll('td')).slice(1, 4).map((cell) => cell.textContent)).toEqual(['待核实', '待核实', '无法比较'])
    }
    expect(compareCompanyVerdict(x, x)).toBeNull()
    const banner = dom(<CompareVerdictBar a={x} b={x} />).textContent
    expect(banner).toContain('暂不判断综合优劣')
    expect(banner).not.toMatch(/基本一致|DRAW|RISK/)
    chart.mockClear()
    const radar = dom(<DualRadar a={x} b={x} />)
    expect(radar.textContent).toContain('无法比较')
    expect(values(chart.mock.lastCall![0])[0][2]).toBe('-')
    expect(values(chart.mock.lastCall![0])[0][4]).toBe('-')
  })

  it('一侧已核实为零时，保留真实零值，另一侧仍待核实且无法比较', () => {
    const known = analyze(base)
    const unknown = analyze({ ...base, legal: undefined })
    const table = dom(<MetricCompareTable a={known} b={unknown} />)
    expect(Array.from(row(table, '诉讼数量').querySelectorAll('td')).slice(1, 4).map((cell) => cell.textContent)).toEqual(['0 起', '待核实', '无法比较'])
    const completeTable = dom(<MetricCompareTable a={known} b={known} />)
    expect(row(completeTable, '诉讼数量').textContent).toContain('±0')
    expect(compareCompanyVerdict(known, known)).toBe('draw')
  })

  it('财务缺失时仍保留单独取得的质押值，防御评分与财务指标不可比较', () => {
    const x = analyze({ ...base, financial: undefined, people: [{ name: '股东', role: '股东', event: '质押', amount: 45, date: '2026-09-01' }] })
    const table = dom(<MetricCompareTable a={x} b={analyze(base)} />)
    expect(row(table, '质押比例').querySelectorAll('td')[1].textContent).toBe('45%')
    expect(row(table, '经营现金流').textContent).toContain('无法比较')
    expect(dom(<PledgeSummary xray={x} />).textContent).toContain('资产覆盖率 待核实')
  })
})

describe('报告各展示入口使用相同证据状态', () => {
  it('报告头、分享卡、质押卡和雷达不展示缺失财务的占位数字或安全结论', () => {
    const x: CompanyXRay = analyze({ meta: base.meta })
    const character = dom(<CharacterPanel xray={x} />).textContent
    expect(character).toContain('资料不足')
    expect(character).not.toMatch(/铜墙铁壁|低风险|质押 0%|现金流 0/)
    const header = dom(<MetaStrip xray={x} />).textContent
    expect(header).toContain('风险评分暂无法判断')
    expect(header).not.toContain('/ 100')
    const share = dom(<ShareCard xray={x} />).textContent
    expect(share).toContain('HP待核实')
    expect(share).toContain('DEF待核实')
    expect(share).toContain('RISK SCORE待核实')
    expect(dom(<PledgeSummary xray={x} />).textContent).toContain('比例暂无法判断')
    chart.mockClear()
    dom(<AttributeRadar xray={x} />)
    expect(values(chart.mock.lastCall![0])[0]).toEqual(['-', '-', '-', '-', '-'])
  })

  it('实际叙事卡不再用固定伤害文案覆盖零诉讼，缺失舆情不声称永久加载', () => {
    const known = analyze(base)
    expect(dom(<NarrativeCard id="legal" k="atk" xray={known} compact />).textContent).toContain('未发现诉讼记录')
    expect(dom(<NarrativeCard id="legal" k="atk" xray={known} />).textContent).not.toContain('滴血')
    const unknown = analyze({ ...base, sentiment: undefined })
    expect(dom(<NarrativeCard id="morale" k="morale" xray={unknown} />).textContent).toContain('暂无法判断')
    expect(dom(<CharacterPanel xray={unknown} />).textContent).not.toContain('新闻加载中')
  })
})
