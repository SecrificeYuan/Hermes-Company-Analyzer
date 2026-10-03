// lib/chat/tools.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeXray } from '@/lib/__tests__/fixtures'

vi.mock('@/lib/data/eastmoney', () => ({ suggestCompanies: vi.fn() }))
vi.mock('@/lib/data/company-discovery', () => ({ searchCompanies: vi.fn() }))
vi.mock('@/lib/get-xray', () => ({ getXRay: vi.fn() }))
vi.mock('@/lib/data/company-health', () => ({ findCompany: vi.fn(), getCompanyHealth: vi.fn() }))
vi.mock('@/lib/data/health-xray', () => ({ healthToXray: vi.fn((h) => ({ ...makeXray({}), ...h })) }))

import { suggestCompanies } from '@/lib/data/eastmoney'
import { searchCompanies } from '@/lib/data/company-discovery'
import { getXRay } from '@/lib/get-xray'
import { findCompany, getCompanyHealth } from '@/lib/data/company-health'
import { executeTool, toolSpecs } from './tools'

describe('lib/chat/tools', () => {
  beforeEach(() => vi.clearAllMocks())

  it('暴露 9 个工具且顺序固定', () => {
    expect(toolSpecs.map((t) => t.function.name)).toEqual([
      'suggest_companies', 'confirm_company', 'run_xray', 'run_health_check',
      'get_market_quote', 'get_fund_flow', 'get_news', 'compare_companies', 'get_announcements',
    ])
  })

  it('suggest_companies 返回候选列表', async () => {
    vi.mocked(suggestCompanies).mockResolvedValue([{ id: '1', name: '贵州茅台', stockCode: '600519' }])
    expect(await executeTool('suggest_companies', { name: '茅台' }))
      .toEqual({ suggestions: [{ id: '1', name: '贵州茅台', stockCode: '600519' }] })
  })

  it('confirm_company 唯一精确命中才 found', async () => {
    vi.mocked(searchCompanies).mockResolvedValue({ suggestions: [{ id: '1', name: '贵州茅台', fullName: '贵州茅台', creditCode: '', stockCode: '600519' } as never], sources: [] })
    expect((await executeTool('confirm_company', { name: '贵州茅台' })).found).toBe(true)
    vi.mocked(searchCompanies).mockResolvedValue({ suggestions: [{ id: '1', name: 'A' } as never, { id: '2', name: 'B' } as never], sources: [] })
    expect((await executeTool('confirm_company', { name: '茅台' })).found).toBe(false)
  })

  it('run_xray 返回报告卡快照并透传 scenario 给 getXRay', async () => {
    vi.mocked(getXRay).mockResolvedValue(makeXray({
      id: '600519', name: '贵州茅台', overallRisk: 'green', verdict: '结论',
      hiddenStatus: [{ id: 'x', label: '老板套现', severity: 'high', description: 'd', evidence: [] }],
      asOf: '2026-10-03',
    }))
    const result = await executeTool('run_xray', { company_id: '600519', scenario: '买股票' })
    expect(result.reportCard).toMatchObject({
      reportId: '600519', overallRisk: 'green',
    })
    expect(result.scenario).toBe('买股票')
    // 全量化：命中信号与五维事实进回传
    const card = result.reportCard as { 命中信号: Array<{ 信号: string }>; 五维事实: Record<string, unknown> }
    expect(card.命中信号).toEqual([{ 信号: '老板套现', 严重度: 'high', 说明: 'd', 证据: [] }])
    expect(card.五维事实).toBeTruthy()
    expect(vi.mocked(getXRay)).toHaveBeenCalledWith('600519', '买股票')
  })

  it('run_health_check：findCompany 找不到 → {error}', async () => {
    vi.mocked(findCompany).mockResolvedValue(null)
    expect((await executeTool('run_health_check', { company_id: 'gym' })).error).toContain('资料不足')
  })

  it('run_health_check：走 find→health→convert 链路', async () => {
    vi.mocked(findCompany).mockResolvedValue({ id: 'gym', name: 'X' } as never)
    vi.mocked(getCompanyHealth).mockResolvedValue({ id: 'gym' } as never)
    const result = await executeTool('run_health_check', { company_id: 'gym' })
    expect(vi.mocked(getCompanyHealth)).toHaveBeenCalledWith({ id: 'gym', name: 'X' })
    expect(result.reportCard).toMatchObject({ reportId: 'gym' })
    expect(result.reportCard).toBeTruthy()
    expect((result.reportCard as Record<string, unknown>).五维事实).toBeTruthy()
  })

  it('未知工具 → {error}', async () => {
    expect((await executeTool('nope', {})).error).toContain('nope')
  })

  it('工具抛异常 → {error} 不抛出', async () => {
    vi.mocked(suggestCompanies).mockRejectedValue(new Error('网络炸'))
    expect((await executeTool('suggest_companies', { name: 'x' })).error).toContain('网络炸')
  })
})
