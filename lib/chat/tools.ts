// Agent 工具集：4 个工具薄包装现有数据平台。铁律：任何异常包成 { error: 人话 } 返回，绝不抛出。
import type { ToolSpec } from '@/lib/llm/client'
import type { CompanyXRay } from '@/lib/types'
import { suggestCompanies } from '@/lib/data/eastmoney'
import { searchCompanies } from '@/lib/data/company-discovery'
import { getXRay } from '@/lib/get-xray'
import { findCompany, getCompanyHealth } from '@/lib/data/company-health'
import { healthToXray } from '@/lib/data/health-xray'

const SCENARIOS = '买股票/买理财/加盟/入职/合作/买房/留学'

export const toolSpecs: ToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'suggest_companies',
      description: `按名称关键词联想候选公司（上市/新三板/工商主体，≤6 条）。当用户提到公司但主体不明确时必须先调用本工具或 confirm_company 消歧，禁止猜测公司 ID。`,
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: '公司名关键词，2-40 字' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirm_company',
      description: `精确确认公司主体：名称、曾用名、统一社会信用代码或 ID 唯一命中才算 confirmed。命中后拿到 company.id 供 run_xray / run_health_check 使用。主体不明确必须先 suggest/confirm，禁止猜测。`,
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: '完整公司名 / 信用代码 / 股票代码或 ID' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_xray',
      description: `对上市公司主体跑完整 X-Ray 尽调（联网取数+分析，约 6 秒）。返回报告卡快照：风险等级、结论、隐藏减分项。company_id 必须来自 suggest/confirm 的结果，禁止猜测。scenario 为用户支付场景七类之一：${SCENARIOS}。`,
      parameters: {
        type: 'object',
        properties: {
          company_id: { type: 'string', description: '已确认主体的 id（股票代码等）' },
          scenario: { type: 'string', description: `支付场景，七类之一：${SCENARIOS}` },
        },
        required: ['company_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_health_check',
      description: `对工商主体（含非上市小公司）做轻量尽调（工商+司法+舆情），比 run_xray 快、覆盖未上市主体。company_id 必须先 suggest/confirm，禁止猜测。scenario 为支付场景七类之一：${SCENARIOS}。`,
      parameters: {
        type: 'object',
        properties: {
          company_id: { type: 'string', description: '已确认主体的 id' },
          scenario: { type: 'string', description: `支付场景，七类之一：${SCENARIOS}` },
        },
        required: ['company_id'],
      },
    },
  },
]

function reportCard(xray: CompanyXRay, scenario?: string) {
  return {
    reportId: xray.id,
    name: xray.name,
    stockCode: xray.stockCode,
    overallRisk: xray.overallRisk,
    riskScore: xray.riskScore,
    verdict: xray.verdict,
    debuffItems: (xray.hiddenStatus ?? []).map((h) => ({
      id: h.id, label: h.label, severity: h.severity, description: h.description,
    })),
    asOf: xray.asOf,
    scenario: scenario ?? null,
  }
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case 'suggest_companies': {
        const q = String(args.name ?? '').trim()
        if (!q) return { error: '缺少公司名关键词 name' }
        return { suggestions: await suggestCompanies(q) }
      }
      case 'confirm_company': {
        const q = String(args.name ?? '').trim()
        if (!q) return { error: '缺少公司名 name' }
        const result = await searchCompanies(q)
        const exact = result.suggestions.filter(
          (c) => c.name === q || c.fullName === q || c.creditCode === q || c.id === q,
        )
        const company = exact.length === 1 ? exact[0] : undefined
        return { ...result, found: Boolean(company), company, ambiguous: !company && result.suggestions.length > 0 }
      }
      case 'run_xray': {
        const id = String(args.company_id ?? '').trim()
        if (!id) return { error: '缺少 company_id，请先 suggest/confirm 确认主体' }
        const scenario = args.scenario ? String(args.scenario) : undefined
        const xray = await getXRay(id, scenario)
        return { reportCard: reportCard(xray, scenario) }
      }
      case 'run_health_check': {
        const id = String(args.company_id ?? '').trim()
        if (!id) return { error: '缺少 company_id，请先 suggest/confirm 确认主体' }
        const identity = await findCompany(id)
        if (!identity) return { error: `找不到「${id}」的主体资料，资料不足，无法尽调。请先 suggest/confirm 确认。` }
        const health = await getCompanyHealth(identity)
        const xray = healthToXray(health)
        return { reportCard: { ...xray, ...reportCard(xray, args.scenario ? String(args.scenario) : undefined) } }
      }
      default:
        return { error: `未知工具：${name}` }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '工具执行失败' }
  }
}
