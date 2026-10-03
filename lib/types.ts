/**
 * lib/types.ts —— 三人并行的唯一契约真源
 *
 * 分层约定：
 *   Data Layer（lib/data）      产出 RawCompanyData —— 原始、未加工
 *   Analysis Layer（lib/analysis）消费 RawCompanyData，产出 CompanyXRay
 *   Presentation Layer（app/components）只认 CompanyXRay，绝不碰 RawCompanyData
 *
 * 修改规则：任何字段变更必须三人确认并同步更新 docs/ 三份文档，禁止单方面改契约。
 */

// ============================================================
// 第一层：数据源引擎输出
// ============================================================

export type DataSourceName = 'eastmoney_financial' | 'eastmoney_profile' | 'eastmoney_announcements' | 'eastmoney_pledge' | 'eastmoney_holders' | 'eastmoney_news' | 'akshare' | 'cninfo' | 'juhe' | 'gdelt' | 'public_web' | 'mock'

export interface DataSourceStatus {
  name: DataSourceName
  /** 该来源是否成功返回了有效数据 */
  ok: boolean
  latencyMs: number
  /** true = 本次使用了 mock 兜底（前端据此展示"降级"角标，诚实加分） */
  fallback: boolean
}

export interface FinancialYear {
  year: string
  revenue: number // 营业收入，万元
  netProfit: number // 净利润，万元
  operatingCashFlow: number // 经营现金流净额，万元
  debtRatio: number // 资产负债率，%
  currentRatio?: number // 流动比率（如 1.5）；银行业等不披露该指标的公司可缺省
}

/** 十大股东（v1.2 增量，可选）：数据源为东方财富 F10 股东持股 */
export interface Shareholder {
  name: string
  ratio: number // 持股比例，%
  isInstitution: boolean
  date?: string // 报告期 YYYY-MM-DD
}

export type AnnouncementType = '减持' | '质押' | '诉讼' | '问询' | '年报' | '其他'

export interface Announcement {
  date: string // ISO YYYY-MM-DD
  title: string
  type: AnnouncementType
  url: string
  summary?: string
}

export interface Lawsuit {
  date: string
  role: '原告' | '被告'
  amount: number // 涉案金额，万元
  cause: string // 案由
}

export interface Execution {
  date: string
  amount: number // 执行标的，万元
  status: string
}

export interface SentimentItem {
  date: string
  tone: number // -10 ~ +10
  headline: string
  source: string
  /** 东方财富新闻的原始报道入口；缺省表示历史数据源未提供链接。 */
  url?: string
}

/**
 * 舆情是独立慢数据源：报告主体不等待它。available 才能用于舆情结论；
 * unavailable 表示查询完成但没有可验证的报道，failed 表示上游或网络异常。
 */
export type SentimentFetchStatus = 'available' | 'unavailable' | 'failed'
export type SentimentHistoryStatus = 'recent' | 'backfilling' | 'complete' | 'partial' | 'limited'

export interface SentimentSnapshot {
  companyId: string
  status: SentimentFetchStatus
  source: '东方财富新闻'
  fetchedAt: string
  items: SentimentItem[]
  /** 仅在 status=available 时存在，避免用 0 或 50 伪装未知。 */
  morale?: CompanyXRay['morale']
  coverage?: { from: string; to: string }
  /** 当前响应对应的东方财富搜索页。 */
  page?: number
  hasMore?: boolean
  totalHits?: number
  /** 年度历史由浏览器渐进回补，状态不会影响已呈现的新闻。 */
  historyStatus?: SentimentHistoryStatus
  loadedPages?: number
  /** 面向界面的诚实错误说明，不包含上游内部错误详情。 */
  message?: string
}

export interface PersonEvent {
  name: string
  role: string
  /** 事件类型：减持 / 离职 / 质押 / 增持
   *  约定：event 为 '质押' 时，amount 填累计质押比例（0-100 的百分数）；
   *       其余事件 amount 为金额（万元）。 */
  event: string
  date: string
  amount?: number
}

export type NarrativeType = 'debt' | 'pledge' | 'lawsuit' | 'sentiment' | 'balanced'

export type NarrativeKey = 'hp' | 'def' | 'atk' | 'morale' | 'network'

export interface RegistryInfo {
  fullName: string // 公司全称
  creditCode: string // 统一社会信用代码
  foundedAt: string // 成立日期 YYYY-MM-DD
  registeredCapital: number // 注册资本，万元
  /** 东方财富 F10 披露的公司简介，可能随上市公司更新。 */
  profile?: string
  mainBusiness?: string
  /** 原始 F10 公司概况页，供用户回查。 */
  sourceUrl?: string
}

/** LLM 解读（v1.1 预留可选）：数据归引擎，解读归 AI */
export interface LlmSummary {
  summary: string // 全报告摘要 → PRO「AI 分析」section
  sectionNotes?: Partial<Record<NarrativeKey, string>> // 各维度解读 → LITE 叙事卡文案源
  generatedAt: string // ISO 时间
  model: string // 模型标识
  /** 灯理由的 LLM 覆写（可选）：存在时 LightBanner 优先于模板 reason */
  lightReason?: string
}

export interface RawCompanyData {
  meta: {
    id: string
    name: string
    stockCode?: string
    industry: string
    fetchedAt: string // ISO 时间；分析引擎以它为"当下"计算近 N 天窗口
    registry?: RegistryInfo // 工商注册信息（v1.1 增量，可选）
    sources: DataSourceStatus[]
  }
  financial?: { years: FinancialYear[] } // 按年份升序
  announcements?: Announcement[] // 按日期倒序
  legal?: {
    lawsuits: Lawsuit[]
    executions: Execution[]
    dishonest: number // 失信被执行人次数
  }
  sentiment?: SentimentItem[] // 按日期升序
  people?: PersonEvent[]
  shareholders?: Shareholder[] // 十大股东，按持股比例降序
  llm?: LlmSummary // LLM 解读（可选），占位期由 mock 提供示例
}

// ============================================================
// 第二层：分析引擎输出 —— 前端唯一消费对象
// ============================================================

export type RiskLevel = 'green' | 'yellow' | 'red'

/** 灯（LITE 首屏唯一结论，v1.1 增量可选字段） */
export interface LightVerdict {
  color: RiskLevel
  headline: string          // 固定三句：先别付这钱 / 能付，但换个付法 / 这钱能付
  reason: string            // 一句人话；llm.lightReason 存在时优先
  saferAdvice?: string      // 仅黄灯：怎么付更安全
  limitedSignals?: boolean  // 非上市"基于公开信号"诚实角标
}
export type Severity = 'low' | 'mid' | 'high'

export interface DimensionScore {
  score: number // 0-100
  label: string // 游戏化评语，如 "重度失血"
  /** false 时数值仅为兼容占位，不能展示成已知指标或用于比较。 */
  available?: boolean
}

export interface HiddenStatus {
  id: string
  label: string // "老板套现"
  severity: Severity
  description: string // 人话解释
  evidence: { source: string; date: string; detail: string; url?: string }[]
  /** 层数刻度（v1.1 增量）：如质押 30/60/80 → { current: 2, max: 3 } */
  tier?: { current: number; max: number }
  /** 致命 debuff（v1.1 增量）：命中即红灯（无牌照/未备案招商等品类弹药） */
  fatal?: boolean
}

export interface TimelineEvent {
  date: string
  event: string
  category: 'finance' | 'legal' | 'people' | 'sentiment'
  severity: Severity
}

export interface GraphNode {
  id: string
  name: string
  type: 'company' | 'person' | 'holder' | 'court' | 'supplier' | 'media'
  risk: number // 0-100
}

export interface GraphLink {
  source: string
  target: string
  label: string
  risk: boolean
}

export interface CompanyXRay {
  id: string
  name: string
  stockCode?: string
  industry: string
  generatedAt: string

  overallRisk: RiskLevel
  riskScore: number // 0-100，越高越危险

  hp: DimensionScore & { cashFlow: number; debtRatio: number; trend: number[]; labels?: string[] } // trend = 各年经营现金流（万元）升序；labels = 对应年份（v1.1 增量，可选）
  def: DimensionScore & { pledgeRatio: number; assetCoverage: number; pledgeAvailable?: boolean }
  atk: DimensionScore & {
    lawsuitCount: number
    executionAmount: number
    /** false 表示司法切片尚未取得；UI 不得将占位分数或 0 条记录解释为真实结论。 */
    available?: boolean
  }
  morale: DimensionScore & {
    avgTone: number
    trend: number[]
    labels?: string[]
    /** false 时舆情尚未独立取回，UI 不得把 score/avgTone 解释为真实结论。 */
    available?: boolean
  } // trend = 近 12 个月舆情 tone 均值（-10~10）升序；labels = 对应月份 YYYY-MM（v1.1 增量，可选）

  hiddenStatus: HiddenStatus[]

  timeline: TimelineEvent[] // 近 12 个月，按日期倒序

  graph: {
    nodes: GraphNode[]
    links: GraphLink[]
  }

  verdict: string // "表面是科技新星，实际血条 32%…"
  advice: string // "不建议将储蓄投入"

  /** 工商注册信息（v1.1 增量，可选），PRO 元信息条使用 */
  registry?: RegistryInfo
  /** 风险叙事版式（v1.1 预留，可选）：存在时前端直接采用，跳过本地推导 */
  narrative?: NarrativeType
  /** LLM 解读（可选），占位期由 mock 提供示例 */
  llm?: LlmSummary
  /** 灯（v1.1 增量可选）：缺席时渲染层按 overallRisk 映射兜底 */
  light?: LightVerdict
  /** 分析基准时，锚定 meta.fetchedAt，保证演示可复现 */
  asOf: string

  /** v1.1 增量字段（可选，不破坏 v1 消费者）：
   *  数据来源状态，前端用于展示"数据来源/降级"角标。 */
  sources?: DataSourceStatus[]

  /** LLM 行动建议（可选）：亮灯后的「下一步」清单，失败时不存在（UI 回退模板 advice）。 */
  nextSteps?: {
    scenario: string // 意图场景，如「买理财」
    items: string[] // 3–5 条行动项
    caveat: string // 诚实标注，如「历史不代表未来」
    generatedAt: string
    model: string
  }

  /** v1.3 增量字段（可选）：PRO 详读层表格消费的明细切片，由 analyze() 从 raw 透传，不做计算。 */
  detail?: {
    financialYears: FinancialYear[]
    lawsuits: Lawsuit[]
    executions: Execution[]
    dishonest: number
    sentimentItems: SentimentItem[]
    shareholders: Shareholder[]
    announcements: Announcement[]
    people: PersonEvent[]
  }
}

// ============================================================
// 通用
// ============================================================

export const SEVERITY_WEIGHT: Record<Severity, number> = { high: 10, mid: 5, low: 2 }
