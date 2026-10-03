// Agent 工具集：9 个工具薄包装现有数据平台。铁律：任何异常包成 { error: 人话 } 返回，绝不抛出。
import type { ToolSpec } from '@/lib/llm/client'
import type { CompanyXRay } from '@/lib/types'
import { suggestCompanies } from '@/lib/data/eastmoney'
import { searchCompanies } from '@/lib/data/company-discovery'
import { getXRay } from '@/lib/get-xray'
import { findCompany, getCompanyHealth } from '@/lib/data/company-health'
import { healthToXray } from '@/lib/data/health-xray'
import { buildFactPayload, buildSignalPayload } from '@/lib/llm/facts'

const SCENARIOS = '买股票/买理财/加盟/报班培训/办卡预付费/供应商预付/其他'

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
      description: `对上市公司主体跑完整 X-Ray 尽调（联网取数+分析，约 6 秒）。返回全量报告卡快照：风险等级、结论、五维事实、命中信号。company_id 必须来自 suggest/confirm 的结果，禁止猜测。scenario 为用户支付场景七类之一：${SCENARIOS}。`,
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
  {
    type: 'function',
    function: {
      name: 'get_market_quote',
      description: `查询上市公司的实时行情快照：最新价、涨跌幅、成交额、市值、市盈率。company_id 为已确认主体的股票代码。`,
      parameters: {
        type: 'object',
        properties: { company_id: { type: 'string', description: '已确认主体的股票代码' } },
        required: ['company_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_fund_flow',
      description: `查询上市公司当日资金流向：主力净流入、散户净流入。company_id 为已确认主体的股票代码。`,
      parameters: {
        type: 'object',
        properties: { company_id: { type: 'string', description: '已确认主体的股票代码' } },
        required: ['company_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_news',
      description: `查询目标主体近 30 天相关新闻/舆情：平均情绪 tone、正负面情绪条目。company_id 为已确认主体的 id。`,
      parameters: {
        type: 'object',
        properties: { company_id: { type: 'string', description: '已确认主体的 id' } },
        required: ['company_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_companies',
      description: `对两家公司已确认主体各跑一次 X-Ray/健康检查并输出并排对比事实（灯色、风险评分、五维分差、命中信号差）。company_a_id / company_b_id 都必须先 suggest/confirm。`,
      parameters: {
        type: 'object',
        properties: {
          company_a_id: { type: 'string', description: 'A 公司已确认主体的 id' },
          company_b_id: { type: 'string', description: 'B 公司已确认主体的 id' },
        },
        required: ['company_a_id', 'company_b_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_announcements',
      description: `查询上市公司近期公告列表（按日期倒序，含标题与类型）。company_id 为已确认主体的股票代码。cninfo 开关未开启时返回空列表。`,
      parameters: {
        type: 'object',
        properties: { company_id: { type: 'string', description: '已确认主体的股票代码' } },
        required: ['company_id'],
      },
    },
  },
]

/** 面向 LLM 的全量事实（run_xray 回传用：从「几个分数」升级为五维事实+信号+证据） */
export function xrayFactPayload(xray: CompanyXRay) {
  return {
    reportId: xray.id,
    name: xray.name,
    stockCode: xray.stockCode ?? null,
    overallRisk: xray.overallRisk,
    riskScore: xray.riskScore,
    verdict: xray.verdict,
    asOf: xray.asOf,
    五维事实: buildFactPayload(xray),
    命中信号: buildSignalPayload(xray),
    nextSteps: xray.nextSteps?.items ?? null,
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
        return { reportCard: xrayFactPayload(xray), scenario: scenario ?? null }
      }
      case 'run_health_check': {
        const id = String(args.company_id ?? '').trim()
        if (!id) return { error: '缺少 company_id，请先 suggest/confirm 确认主体' }
        const identity = await findCompany(id)
        if (!identity) return { error: `找不到「${id}」的主体资料，资料不足，无法尽调。请先 suggest/confirm 确认。` }
        const health = await getCompanyHealth(identity)
        const xray = healthToXray(health)
        return { reportCard: { ...xrayFactPayload(xray), scenario: args.scenario ? String(args.scenario) : null } }
      }
      case 'get_market_quote': {
        const id = String(args.company_id ?? '').trim()
        if (!id) return { error: '缺少 company_id，请先 suggest/confirm 确认主体' }
        const { fetchTencentQuote } = await import('@/lib/data/adapters/market')
        const quote = await fetchTencentQuote(id)
        if (!quote) return { error: '行情数据暂未取回（非上市主体或数据源暂不可用）' }
        return { quote }
      }
      case 'get_fund_flow': {
        const id = String(args.company_id ?? '').trim()
        if (!id) return { error: '缺少 company_id，请先 suggest/confirm 确认主体' }
        const { fetchEastmoneyFundFlow, toSecid } = await import('@/lib/data/adapters/market')
        const secid = toSecid(id)
        if (!secid) return { error: '资金流向仅支持上市公司股票代码' }
        const days = await fetchEastmoneyFundFlow(secid)
        if (!days.length) return { error: '资金流向数据暂未取回（数据源暂不可用）' }
        const latest = days[days.length - 1]
        return {
          fundFlow: {
            date: latest.date,
            main: latest.main,
            medium: latest.medium,
            small: latest.small,
            source: latest.source ?? 'eastmoney',
          },
        }
      }
      case 'get_news': {
        const id = String(args.company_id ?? '').trim()
        if (!id) return { error: '缺少 company_id，请先 suggest/confirm 确认主体' }
        const xray = await getXRay(id)
        const items = (xray.detail?.sentimentItems ?? []).slice(-10)
        if (!items.length) return { news: [], note: '该主体近 30 天舆情/新闻数据尚未取回或为空' }
        return {
          news: items.map((s) => ({ date: s.date, headline: s.headline, tone: s.tone, source: s.source })),
          avgTone: xray.morale.avgTone,
        }
      }
      case 'compare_companies': {
        const aId = String(args.company_a_id ?? '').trim()
        const bId = String(args.company_b_id ?? '').trim()
        if (!aId || !bId) return { error: '缺少 company_a_id / company_b_id，请先 suggest/confirm 确认双方主体' }
        const [a, b] = await Promise.all([getXRay(aId), getXRay(bId)])
        return {
          A: xrayFactPayload(a),
          B: xrayFactPayload(b),
          综合差值: {
            风险评分: `A ${a.riskScore} vs B ${b.riskScore}（低者更稳）`,
            基本面健康度: `A ${a.hp.score} vs B ${b.hp.score}`,
            偿债安全垫: `A ${a.def.score} vs B ${b.def.score}`,
          },
        }
      }
      case 'get_announcements': {
        const id = String(args.company_id ?? '').trim()
        if (!id) return { error: '缺少 company_id，请先 suggest/confirm 确认主体' }
        const xray = await getXRay(id)
        const items = (xray.detail?.announcements ?? []).slice(0, 10)
        if (!items.length) return { announcements: [], note: '公告数据未取回（cninfo 开关可能未开启）' }
        return {
          announcements: items.map((a) => ({ date: a.date, title: a.title, type: a.type })),
        }
      }
      default:
        return { error: `未知工具：${name}` }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '工具执行失败' }
  }
}
