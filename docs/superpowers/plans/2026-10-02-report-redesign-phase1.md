# /report 重设计 · 第一期（骨架与版式）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 落地 `/report` 新信息架构（两层阅读流）与风险叙事版式系统：PRO 获得元信息条 + 锚点导航 + 七个 section 容器，LITE 获得融合角色横幅与叙事卡流，版式由 `narrativeOf()` 纯函数驱动。

**架构：** 契约层增量扩展（registry / asOf / narrative / llm 可选字段）→ 纯函数层（`lib/narrative.ts` 判定与编排 + `lib/narrative-copy.ts` LITE 文案）→ 组件层（MetaStrip / NarrativeCard / AnchorNav / detail sections）→ XrayClient 重排。测试集中在纯函数与契约层（现有基建无组件测试库，组件靠 typecheck + lint + 手动验证）。

**技术栈：** Next.js 15 App Router · React 19 · TypeScript · Tailwind（双主题 CSS 变量）· zustand · framer-motion · ECharts（自研 `EChart` 封装）· vitest（jsdom）。

**规格依据：** `docs/superpowers/specs/2026-10-02-report-redesign-design.md`（第一期范围 = 规格 §9 第一期）。

---

## 文件结构

**新建：**
- `lib/narrative.ts` — 版式判定（narrativeOf）+ 速览层/详读层编排纯函数（glanceLayout / detailOrder）
- `lib/narrative-copy.ts` — LITE 叙事卡文案模板（含 llm 覆盖）+ 单位/大数字组装
- `lib/__tests__/narrative.test.ts` — 判定与编排测试（含三家 mock 集成断言）
- `lib/__tests__/registry.test.ts` — 契约透传测试
- `components/xray/MetaStrip.tsx` — PRO 元信息条（健康度环 + 工商 kv + 评级 + 摘要）
- `components/xray/NarrativeCard.tsx` — LITE 叙事卡
- `components/xray/MiniDimCard.tsx` — LITE 速览层迷你维度卡
- `components/xray/AnchorNav.tsx` — PRO 锚点导航（scroll-spy）
- `components/xray/detail/SectionShell.tsx` — section 容器（锚点 id）
- `components/xray/detail/FinancialSection.tsx` / `EquitySection.tsx` / `LegalSection.tsx` / `SentimentSection.tsx` / `NetworkSection.tsx` / `EvidenceSection.tsx` / `AiSection.tsx`

**修改：**
- `lib/types.ts` — `NarrativeType` / `NarrativeKey` / `RegistryInfo` / `LlmSummary` 类型；`RawCompanyData.meta.registry?`、`RawCompanyData.llm?`、`CompanyXRay.registry?` / `narrative?` / `llm?` / `asOf` 字段；删除无引用的 `RISK_COLOR`
- `lib/analysis/analyze.ts` — `registry` / `llm` / `asOf` 透传
- `lib/theme/terms.ts` — `sections` / `metaStrip` / `narrativeTitles` / `dimensionTitles` 键 + `LITE_BANNED_TERMS` 词表
- `data/mock/company-danger.json` — `meta.registry` + 顶层 `llm` 示例
- `components/xray/CashFlowChart.tsx` 等 5 个图表组件 — 可选 `height` prop
- `components/xray/CharacterCard.tsx` — 去除 PRO 分支（ProCard 移入 MetaStrip），LITE 卡并入评级徽章/风险分/来源角标
- `components/xray/XrayClient.tsx` — 两层重排（头/速览层/详读层），删除 VerdictBanner 引用

**删除：**
- `components/xray/VerdictBanner.tsx`（职责分流到 MetaStrip 与 CharacterCard）

---

## 任务 1：契约层扩展（types + analyze + mock）

**文件：**
- 修改：`lib/types.ts`
- 修改：`lib/analysis/analyze.ts`（返回对象处，当前 42-60 行）
- 修改：`data/mock/company-danger.json`（meta 与顶层）
- 测试：`lib/__tests__/registry.test.ts`（新建）

- [ ] **步骤 1：编写失败的测试**

新建 `lib/__tests__/registry.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { analyze } from '@/lib/analysis/analyze'
import dangerJson from '@/data/mock/company-danger.json'
import warningJson from '@/data/mock/company-warning.json'
import type { RawCompanyData } from '@/lib/types'

const raw = (j: unknown) => j as RawCompanyData

describe('契约层扩展', () => {
  it('registry 从 RawCompanyData.meta 透传到 CompanyXRay', () => {
    const x = analyze(raw(dangerJson))
    expect(x.registry?.fullName).toBe('恒晟地产集团有限公司')
    expect(x.registry?.creditCode).toBe('91330100MA2B7X9K3Q')
    expect(x.registry?.registeredCapital).toBe(156000)
  })

  it('asOf 锚定 meta.fetchedAt（而非分析时刻）', () => {
    const x = analyze(raw(dangerJson))
    expect(x.asOf).toBe('2026-10-01T09:00:00+08:00')
  })

  it('llm 示例从 mock 透传', () => {
    const x = analyze(raw(dangerJson))
    expect(x.llm?.sectionNotes?.def).toContain('押')
  })

  it('warning mock 无 registry —— 降级为 undefined 而不报错', () => {
    const x = analyze(raw(warningJson))
    expect(x.registry).toBeUndefined()
    expect(x.llm).toBeUndefined()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run lib/__tests__/registry.test.ts`
预期：TS 编译错误（`registry` / `asOf` / `llm` 不是 `CompanyXRay` 的属性）。

- [ ] **步骤 3：扩展 `lib/types.ts`**

在 `RawCompanyData` 之前（`FinancialYear` 之后附近）新增：

```ts
export type NarrativeType = 'debt' | 'pledge' | 'lawsuit' | 'sentiment' | 'balanced'

export type NarrativeKey = 'hp' | 'def' | 'atk' | 'morale' | 'network'

export interface RegistryInfo {
  fullName: string // 公司全称
  creditCode: string // 统一社会信用代码
  foundedAt: string // 成立日期 YYYY-MM-DD
  registeredCapital: number // 注册资本，万元
}

/** LLM 解读（v1.1 预留可选）：数据归引擎，解读归 AI */
export interface LlmSummary {
  summary: string // 全报告摘要 → PRO「AI 分析」section
  sectionNotes?: Partial<Record<NarrativeKey, string>> // 各维度解读 → LITE 叙事卡文案源
  generatedAt: string // ISO 时间
  model: string // 模型标识
}
```

`RawCompanyData.meta` 增加 `registry?: RegistryInfo`；`RawCompanyData` 顶层增加 `llm?: LlmSummary`；`CompanyXRay` 在 `sources?` 之前增加：

```ts
  /** 工商注册信息（v1.1 增量，可选），PRO 元信息条使用 */
  registry?: RegistryInfo
  /** 风险叙事版式（v1.1 预留，可选）：存在时前端直接采用，跳过本地推导 */
  narrative?: NarrativeType
  /** LLM 解读（可选），占位期由 mock 提供示例 */
  llm?: LlmSummary
  /** 分析基准时，锚定 meta.fetchedAt，保证演示可复现 */
  asOf: string
```

- [ ] **步骤 4：修改 `lib/analysis/analyze.ts` 透传**

返回对象（当前 42-60 行）在 `industry: raw.meta.industry,` 之后追加 `asOf: raw.meta.fetchedAt,`，并在 `sources: raw.meta.sources,` 之前追加：

```ts
    registry: raw.meta.registry,
    llm: raw.llm,
```

- [ ] **步骤 5：修改 `data/mock/company-danger.json`**

`meta` 对象内（`industry` 行后）追加：

```json
    "registry": {
      "fullName": "恒晟地产集团有限公司",
      "creditCode": "91330100MA2B7X9K3Q",
      "foundedAt": "1998-06-12",
      "registeredCapital": 156000
    },
```

顶层（与 `meta` 平级）追加：

```json
  "llm": {
    "summary": "恒晟地产处于典型的债务-质押双杀局面：销售回款枯竭、债务逾期扩大，控股股东高比例质押已触发平仓预警，短期风险极高。",
    "sectionNotes": {
      "def": "大股东已经把股票押到极限了——再多押一股都没有了。"
    },
    "generatedAt": "2026-10-01T09:30:00+08:00",
    "model": "hermes-llm-reserved"
  },
```

- [ ] **步骤 6：运行测试验证通过**

运行：`npx vitest run lib/__tests__/registry.test.ts`
预期：4 个测试全部 PASS。

- [ ] **步骤 7：Commit**

```bash
git add lib/types.ts lib/analysis/analyze.ts data/mock/company-danger.json lib/__tests__/registry.test.ts
git commit -m "feat: 契约扩展 registry/asOf/llm 增量字段与 mock 示例"
```

---

## 任务 2：版式判定与编排纯函数（lib/narrative.ts）

**文件：**
- 创建：`lib/narrative.ts`
- 测试：`lib/__tests__/narrative.test.ts`

- [ ] **步骤 1：编写失败的测试**

新建 `lib/__tests__/narrative.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { narrativeOf, glanceLayout, detailOrder } from '@/lib/narrative'
import { analyze } from '@/lib/analysis/analyze'
import dangerJson from '@/data/mock/company-danger.json'
import warningJson from '@/data/mock/company-warning.json'
import healthyJson from '@/data/mock/company-healthy.json'
import type { CompanyXRay, RawCompanyData, TimelineEvent } from '@/lib/types'

function makeXray(overrides: Partial<CompanyXRay> = {}): CompanyXRay {
  return {
    id: 't', name: '测试', industry: '测试', generatedAt: '', asOf: '',
    overallRisk: 'yellow', riskScore: 50,
    hp: { score: 50, label: '', cashFlow: 0, debtRatio: 50, trend: [] },
    def: { score: 50, label: '', pledgeRatio: 10, assetCoverage: 1 },
    atk: { score: 10, label: '', lawsuitCount: 0, executionAmount: 0 },
    morale: { score: 50, label: '', avgTone: 0, trend: [] },
    hiddenStatus: [], timeline: [],
    graph: { nodes: [], links: [] },
    verdict: '', advice: '',
    ...overrides,
  }
}

const legalTimeline = (n: number): TimelineEvent[] =>
  Array.from({ length: n }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    event: `诉讼${i}`,
    category: 'legal' as const,
    severity: 'mid' as const,
  }))

describe('narrativeOf', () => {
  it('契约字段优先于一切本地推导', () => {
    const r = narrativeOf(makeXray({ narrative: 'sentiment', def: { score: 0, label: '', pledgeRatio: 99, assetCoverage: 0 } }))
    expect(r).toEqual({ type: 'sentiment', via: 'contract' })
  })

  it('质押触发器：60% 命中，59% 不命中', () => {
    expect(narrativeOf(makeXray({ def: { score: 80, label: '', pledgeRatio: 60, assetCoverage: 2 } })).type).toBe('pledge')
    const r = narrativeOf(makeXray({ def: { score: 80, label: '', pledgeRatio: 59, assetCoverage: 2 } }))
    expect(r.type).not.toBe('pledge') // 未达触发线，回到常规判定
  })

  it('诉讼触发器：近 12 月 legal 事件 ≥5 命中', () => {
    expect(narrativeOf(makeXray({ timeline: legalTimeline(5) })).type).toBe('lawsuit')
    expect(narrativeOf(makeXray({ timeline: legalTimeline(4) })).type).not.toBe('lawsuit')
  })

  it('双触发器同时命中时质押优先', () => {
    const x = makeXray({
      def: { score: 0, label: '', pledgeRatio: 72, assetCoverage: 0 },
      timeline: legalTimeline(9),
    })
    expect(narrativeOf(x)).toEqual({ type: 'pledge', via: 'trigger-pledge' })
  })

  it('健康线：hp/def/morale ≥60 且 atk ≤40 → balanced；atk 41 不命中', () => {
    const healthy = makeXray({
      hp: { score: 70, label: '', cashFlow: 1, debtRatio: 30, trend: [] },
      def: { score: 70, label: '', pledgeRatio: 10, assetCoverage: 2 },
      atk: { score: 40, label: '', lawsuitCount: 1, executionAmount: 0 },
      morale: { score: 70, label: '', avgTone: 2, trend: [] },
    })
    expect(narrativeOf(healthy)).toEqual({ type: 'balanced', via: 'healthy' })
    expect(narrativeOf(makeXray({ ...healthy, atk: { score: 41, label: '', lawsuitCount: 2, executionAmount: 0 } } })).type).not.toBe('balanced')
  })

  it('argmax：hp 最危险 → debt（ATK 不参与反转误算）', () => {
    const r = narrativeOf(makeXray({
      hp: { score: 20, label: '', cashFlow: -100, debtRatio: 90, trend: [] },
      atk: { score: 15, label: '', lawsuitCount: 1, executionAmount: 0 },
    }))
    expect(r).toEqual({ type: 'debt', via: 'argmax' })
  })

  it('ATK 语义反转：atk.score 最高 → lawsuit 而非 balanced/debt', () => {
    const r = narrativeOf(makeXray({
      hp: { score: 65, label: '', cashFlow: 1, debtRatio: 40, trend: [] },
      def: { score: 65, label: '', pledgeRatio: 30, assetCoverage: 2 },
      atk: { score: 90, label: '', lawsuitCount: 8, executionAmount: 1000 },
      morale: { score: 65, label: '', avgTone: 0, trend: [] },
    }))
    expect(r.type).toBe('lawsuit')
  })

  it('平局按 质押>诉讼>资金>舆情 固定优先级', () => {
    // def danger 60、atk 60，其余更低 → pledge
    const r = narrativeOf(makeXray({
      hp: { score: 70, label: '', cashFlow: 1, debtRatio: 30, trend: [] },
      def: { score: 40, label: '', pledgeRatio: 30, assetCoverage: 1 },
      atk: { score: 60, label: '', lawsuitCount: 5, executionAmount: 0 }, // legalTimeline 不触发：timeline 空
      morale: { score: 70, label: '', avgTone: 0, trend: [] },
    }))
    expect(r.type).toBe('pledge')
  })
})

describe('三家 mock 公司集成（锁定归属）', () => {
  const danger = analyze(dangerJson as unknown as RawCompanyData)
  const warning = analyze(warningJson as unknown as RawCompanyData)
  const healthy = analyze(healthyJson as unknown as RawCompanyData)

  it('danger → 质押告急（触发器）', () => {
    expect(narrativeOf(danger)).toEqual({ type: 'pledge', via: 'trigger-pledge' })
  })
  it('warning → 资金告急（argmax）', () => {
    expect(narrativeOf(warning)).toEqual({ type: 'debt', via: 'argmax' })
  })
  it('healthy → 稳健均衡（健康线）', () => {
    expect(narrativeOf(healthy)).toEqual({ type: 'balanced', via: 'healthy' })
  })
})

describe('glanceLayout / detailOrder', () => {
  const danger = analyze(dangerJson as unknown as RawCompanyData)
  const healthy = analyze(healthyJson as unknown as RawCompanyData)

  it('danger：C 位 equity，其余按危险度降序 + network 恒为末位', () => {
    const l = glanceLayout(danger, narrativeOf(danger))
    expect(l.c).toBe('equity')
    expect(l.rest).toEqual(['finance', 'legal', 'sentiment', 'network'])
  })

  it('healthy：C 位 radar，五图全小', () => {
    const l = glanceLayout(healthy, narrativeOf(healthy))
    expect(l.c).toBe('radar')
    expect(l.rest).toHaveLength(5)
  })

  it('detailOrder：核心 section 同序传导，evidence/ai 恒为末两位', () => {
    const d = detailOrder(glanceLayout(danger, narrativeOf(danger)))
    expect(d[0]).toBe('equity')
    expect(d).toHaveLength(7)
    expect(d.slice(-2)).toEqual(['evidence', 'ai'])
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run lib/__tests__/narrative.test.ts`
预期：`Cannot find module '@/lib/narrative'`。

- [ ] **步骤 3：实现 `lib/narrative.ts`**

```ts
import type { CompanyXRay, NarrativeType } from '@/lib/types'

export type { NarrativeType }

export type NarrativeVia = 'contract' | 'trigger-pledge' | 'trigger-lawsuit' | 'healthy' | 'argmax'

export interface NarrativeResult {
  type: NarrativeType
  via: NarrativeVia
}

export const PLEDGE_TRIGGER = 60
export const LAWSUIT_TRIGGER = 5
const HEALTHY_MIN = 60
const ATK_HEALTHY_MAX = 40

const VALID_TYPES: readonly NarrativeType[] = ['debt', 'pledge', 'lawsuit', 'sentiment', 'balanced']

/**
 * 风险叙事版式判定（规格 §4.2）。
 * ATK 语义反转：atk.score 越高 = 涉诉战火越旺（风险值），与 hp/def/morale 相反，
 * 统一换算为"危险度"后比较。
 */
export function narrativeOf(x: CompanyXRay): NarrativeResult {
  if (x.narrative && (VALID_TYPES as readonly string[]).includes(x.narrative)) {
    return { type: x.narrative, via: 'contract' }
  }
  const legalEvents = x.timeline.filter((e) => e.category === 'legal').length
  // 触发器优先：数据异常比分数更抓人；双命中时质押优先（平仓风险时间尺度更短）
  if (x.def.pledgeRatio >= PLEDGE_TRIGGER) return { type: 'pledge', via: 'trigger-pledge' }
  if (legalEvents >= LAWSUIT_TRIGGER) return { type: 'lawsuit', via: 'trigger-lawsuit' }
  // 健康线
  if (
    x.hp.score >= HEALTHY_MIN &&
    x.def.score >= HEALTHY_MIN &&
    x.morale.score >= HEALTHY_MIN &&
    x.atk.score <= ATK_HEALTHY_MAX
  ) {
    return { type: 'balanced', via: 'healthy' }
  }
  // 危险度 argmax；平局按声明顺序（质押 > 诉讼 > 资金 > 舆情，sort 稳定性保证）
  const dangers: [NarrativeType, number][] = [
    ['pledge', 100 - x.def.score],
    ['lawsuit', x.atk.score],
    ['debt', 100 - x.hp.score],
    ['sentiment', 100 - x.morale.score],
  ]
  dangers.sort((a, b) => b[1] - a[1])
  return { type: dangers[0][0], via: 'argmax' }
}

// ============================================================
// 编排传导（规格 §4.3）：单一 narrative 驱动速览层与详读层
// ============================================================

export type GlanceSlot = 'finance' | 'equity' | 'legal' | 'sentiment' | 'network'

const NARRATIVE_SLOT: Record<Exclude<NarrativeType, 'balanced'>, GlanceSlot> = {
  debt: 'finance',
  pledge: 'equity',
  lawsuit: 'legal',
  sentiment: 'sentiment',
}

export interface GlanceLayout {
  /** C 位：'radar' 表示均衡版式（雷达大图） */
  c: GlanceSlot | 'radar'
  /** 其余图位：四个维度按危险度降序，关联网络恒为末位 */
  rest: GlanceSlot[]
}

export function glanceLayout(x: CompanyXRay, narrative: NarrativeResult): GlanceLayout {
  const c = narrative.type === 'balanced' ? 'radar' : NARRATIVE_SLOT[narrative.type]
  const danger: [GlanceSlot, number][] = [
    ['finance', 100 - x.hp.score],
    ['equity', 100 - x.def.score],
    ['legal', x.atk.score],
    ['sentiment', 100 - x.morale.score],
  ]
  danger.sort((a, b) => b[1] - a[1])
  const rest = danger.map(([k]) => k).filter((k) => k !== c)
  rest.push('network')
  return { c, rest }
}

export type DetailSectionId = 'financial' | 'equity' | 'legal' | 'sentiment' | 'network' | 'evidence' | 'ai'

const SLOT_SECTION: Record<GlanceSlot, DetailSectionId> = {
  finance: 'financial',
  equity: 'equity',
  legal: 'legal',
  sentiment: 'sentiment',
  network: 'network',
}

/** 详读层 section 顺序（PRO 锚点同序）；evidence / ai 恒为末两位 */
export function detailOrder(layout: GlanceLayout): DetailSectionId[] {
  const core =
    layout.c === 'radar'
      ? layout.rest.map((s) => SLOT_SECTION[s])
      : [SLOT_SECTION[layout.c], ...layout.rest.map((s) => SLOT_SECTION[s])]
  return [...core, 'evidence', 'ai']
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run lib/__tests__/narrative.test.ts`
预期：全部 PASS（含 3 个集成测试）。

- [ ] **步骤 5：Commit**

```bash
git add lib/narrative.ts lib/__tests__/narrative.test.ts
git commit -m "feat: 风险叙事版式判定与编排传导纯函数（含 mock 集成锁定）"
```

---

## 任务 3：术语字典扩展（terms.ts）

**文件：**
- 修改：`lib/theme/terms.ts`
- 测试：`lib/__tests__/terms.test.ts`（追加）

- [ ] **步骤 1：追加失败的测试**

在 `lib/__tests__/terms.test.ts` 末尾追加：

```ts
describe('重设计扩展术语', () => {
  it('七个 section 名双模式齐备且不同', () => {
    const lite = getTerms('lite')
    const pro = getTerms('pro')
    for (const k of ['financial', 'equity', 'legal', 'sentiment', 'network', 'evidence', 'ai'] as const) {
      expect(lite.sections[k]).toBeTruthy()
      expect(pro.sections[k]).toBeTruthy()
      expect(lite.sections[k]).not.toBe(pro.sections[k])
    }
    expect(pro.sections.financial).toBe('财务详情')
    expect(pro.sections.ai).toBe('AI 分析')
  })

  it('narrativeTitles / dimensionTitles 五键齐备', () => {
    const lite = getTerms('lite')
    for (const k of ['debt', 'pledge', 'lawsuit', 'sentiment', 'balanced'] as const) {
      expect(lite.narrativeTitles[k]).toBeTruthy()
      expect(getTerms('pro').narrativeTitles[k]).toBeTruthy()
    }
    for (const k of ['hp', 'def', 'atk', 'morale', 'network'] as const) {
      expect(lite.dimensionTitles[k]).toBeTruthy()
    }
  })

  it('LITE 文案零禁用术语（反向校验）', () => {
    const lite = getTerms('lite')
    const liteCopy = [
      ...Object.values(lite.sections),
      ...Object.values(lite.narrativeTitles),
      ...Object.values(lite.dimensionTitles),
    ].join('|')
    for (const term of LITE_BANNED_TERMS) {
      expect(liteCopy).not.toContain(term)
    }
  })
})
```

文件头 import 改为：`import { getTerms, LITE_BANNED_TERMS } from '@/lib/theme/terms'`

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run lib/__tests__/terms.test.ts`
预期：TS 错误（`sections` / `LITE_BANNED_TERMS` 不存在）。

- [ ] **步骤 3：扩展 `lib/theme/terms.ts`**

`Terms` 接口内 `cardTitles` 之后追加：

```ts
  sections: Record<'financial' | 'equity' | 'legal' | 'sentiment' | 'network' | 'evidence' | 'ai', string>
  metaStrip: { creditCode: string; foundedAt: string; registeredCapital: string; asOf: string; sources: string }
  narrativeTitles: Record<'debt' | 'pledge' | 'lawsuit' | 'sentiment' | 'balanced', string>
  dimensionTitles: Record<'hp' | 'def' | 'atk' | 'morale' | 'network', string>
```

import 行改为 `import type { Mode } from '@/lib/mode-store'`（保持不变），文件末尾追加导出：

```ts
/** LITE 界面禁用词表（专业金融术语）：LITE 渲染文案不得包含（规格 §10 反向校验） */
export const LITE_BANNED_TERMS = [
  '资产负债率', '流动比率', '净利润', '营业收入', '同比', '环比', 'ROE', 'PE', 'PB', '贴现', '流动性危机',
] as const
```

LITE 字典 `cardTitles` 之后追加：

```ts
  sections: {
    financial: '钱袋子',
    equity: '老板押股票',
    legal: '官司',
    sentiment: '口碑',
    network: '关系网',
    evidence: '证据与来源',
    ai: '智能解读',
  },
  metaStrip: { creditCode: '信用代码', foundedAt: '成立日期', registeredCapital: '注册资本', asOf: '分析基准时', sources: '数据来源' },
  narrativeTitles: { debt: '血量告急', pledge: '护盾告急', lawsuit: '麻烦缠身', sentiment: '人心浮动', balanced: '体征平稳' },
  dimensionTitles: { hp: '钱袋子', def: '护盾', atk: '麻烦', morale: '口碑', network: '关系网' },
```

PRO 字典 `cardTitles` 之后追加：

```ts
  sections: {
    financial: '财务详情',
    equity: '股权与质押',
    legal: '涉诉与执行',
    sentiment: '舆情洞察',
    network: '关联网络',
    evidence: '证据溯源',
    ai: 'AI 分析',
  },
  metaStrip: { creditCode: '统一社会信用代码', foundedAt: '成立日期', registeredCapital: '注册资本（万元）', asOf: '分析基准时', sources: '数据来源' },
  narrativeTitles: { debt: '资金承压', pledge: '质押风险突出', lawsuit: '涉诉风险突出', sentiment: '舆情承压', balanced: '经营稳健' },
  dimensionTitles: { hp: '财务健康', def: '股权质押', atk: '涉诉', morale: '舆情', network: '关联网络' },
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run lib/__tests__/terms.test.ts`
预期：全部 PASS。

- [ ] **步骤 5：Commit**

```bash
git add lib/theme/terms.ts lib/__tests__/terms.test.ts
git commit -m "feat: 术语字典扩展 section/narrative/dimension 键 + LITE 禁用词表"
```

---

## 任务 4：LITE 叙事文案纯函数（lib/narrative-copy.ts）

**文件：**
- 创建：`lib/narrative-copy.ts`
- 测试：`lib/__tests__/narrative-copy.test.ts`

- [ ] **步骤 1：编写失败的测试**

新建 `lib/__tests__/narrative-copy.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { narrativeCopy, NARRATIVE_ICONS } from '@/lib/narrative-copy'
import { LITE_BANNED_TERMS } from '@/lib/theme/terms'
import { analyze } from '@/lib/analysis/analyze'
import dangerJson from '@/data/mock/company-danger.json'
import warningJson from '@/data/mock/company-warning.json'
import healthyJson from '@/data/mock/company-healthy.json'
import type { RawCompanyData } from '@/lib/types'

const raw = (j: unknown) => j as RawCompanyData
const KEYS = ['hp', 'def', 'atk', 'morale', 'network'] as const

describe('narrativeCopy', () => {
  it('五把钥匙在三家 mock 上全部产出非空大数字/说明/文案', () => {
    for (const j of [dangerJson, warningJson, healthyJson]) {
      const x = analyze(raw(j))
      for (const k of KEYS) {
        const m = narrativeCopy(k, x)
        expect(m.big).toBeTruthy()
        expect(m.caption).toBeTruthy()
        expect(m.text.length).toBeGreaterThan(10)
        expect(NARRATIVE_ICONS[k]).toBeTruthy()
      }
    }
  })

  it('LITE 文案零禁用术语（反向校验，规格 §10）', () => {
    for (const j of [dangerJson, warningJson, healthyJson]) {
      const x = analyze(raw(j))
      for (const k of KEYS) {
        const m = narrativeCopy(k, x)
        for (const term of LITE_BANNED_TERMS) {
          expect(`${m.caption}|${m.text}`).not.toContain(term)
        }
      }
    }
  })

  it('llm.sectionNotes 覆盖模板文案（danger 的 def 卡）', () => {
    const x = analyze(raw(dangerJson))
    expect(narrativeCopy('def', x).text).toContain('押到极限')
  })

  it('无 llm 时回落模板（healthy）', () => {
    const x = analyze(raw(healthyJson))
    expect(narrativeCopy('hp', x).text).toContain('债')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run lib/__tests__/narrative-copy.test.ts`
预期：`Cannot find module '@/lib/narrative-copy'`。

- [ ] **步骤 3：实现 `lib/narrative-copy.ts`**

```ts
import { formatWan } from '@/lib/utils'
import type { CompanyXRay, NarrativeKey } from '@/lib/types'

export type { NarrativeKey }

export const NARRATIVE_ICONS: Record<NarrativeKey, string> = {
  hp: '💰', def: '🛡️', atk: '⚔️', morale: '📣', network: '🕸️',
}

export interface NarrativeCopy {
  big: string
  caption: string
  text: string
}

/**
 * LITE 叙事卡文案（规格 §5.1 NarrativeCard）。
 * llm.sectionNotes 存在时优先（AI 解读），否则回落人话模板。
 * 模板禁止包含 LITE_BANNED_TERMS 中的专业术语（由测试反向锁定）。
 */
export function narrativeCopy(key: NarrativeKey, x: CompanyXRay): NarrativeCopy {
  const ai = x.llm?.sectionNotes?.[key]
  switch (key) {
    case 'hp': {
      const bleeding = x.hp.cashFlow < 0
      return {
        big: formatWan(x.hp.cashFlow),
        caption: '经营现金流',
        text: ai ?? (bleeding
          ? `一年下来钱包里流出的比流入的多 ${formatWan(-x.hp.cashFlow)}，还在持续失血。`
          : `账上现金能覆盖日常运转，但欠下的债是资产的 ${x.hp.debtRatio}%。`),
      }
    }
    case 'def': {
      const critical = x.def.pledgeRatio >= 60
      return {
        big: `${x.def.pledgeRatio}%`,
        caption: '股权质押比例',
        text: ai ?? (critical
          ? `大股东把手里 ${x.def.pledgeRatio}% 的股票都押出去借钱了。股价再大跌，这些股票会被强制卖掉，公司可能突然换主人。`
          : `大股东押出去的股票不到一半，暂时还稳得住。`),
      }
    }
    case 'atk': {
      const exec = x.atk.executionAmount > 0 ? `，被执行的钱有 ${formatWan(x.atk.executionAmount)}` : ''
      return {
        big: `${x.atk.lawsuitCount} 起`,
        caption: '近一年官司',
        text: ai ?? `最近一年身上挂着 ${x.atk.lawsuitCount} 起官司${exec}，钱包和名声都在流血。`,
      }
    }
    case 'morale': {
      const negative = x.morale.avgTone < 0
      return {
        big: `${x.morale.avgTone}`,
        caption: '舆论温度（-10 ~ +10）',
        text: ai ?? (negative
          ? `网上骂声一片，舆论温度跌到 ${x.morale.avgTone}。员工、供应商和客户都在观望。`
          : `网上风评不错，舆论温度 ${x.morale.avgTone}。`),
      }
    }
    case 'network': {
      const risky = x.graph.links.some((l) => l.risk)
      return {
        big: `${x.graph.nodes.length}`,
        caption: '关联公司 / 人物',
        text: ai ?? `和 ${x.graph.nodes.length} 家公司或人物有股权、生意往来，关系网里${risky ? '有人已经被执行或失信' : '暂时没有爆雷的关联方'}。`,
      }
    }
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run lib/__tests__/narrative-copy.test.ts`
预期：全部 PASS。

- [ ] **步骤 5：Commit**

```bash
git add lib/narrative-copy.ts lib/__tests__/narrative-copy.test.ts
git commit -m "feat: LITE 叙事文案模板（llm 覆盖 + 禁用术语反向校验）"
```

---

## 任务 5：MetaStrip 组件（PRO 头）

**文件：**
- 创建：`components/xray/MetaStrip.tsx`

- [ ] **步骤 1：实现组件**

新建 `components/xray/MetaStrip.tsx`：

```tsx
'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataSourceBadge } from './DataSourceBadge'
import { StatNumber } from './StatNumber'
import { formatWan } from '@/lib/utils'
import { scoreColor } from '@/lib/theme'
import { useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

const RISK_META = {
  green: { label: '低风险 · GREEN', Icon: ShieldCheck, badge: 'safe' as const },
  yellow: { label: '中风险 · YELLOW', Icon: AlertTriangle, badge: 'warn' as const },
  red: { label: '高风险 · RED', Icon: ShieldAlert, badge: 'danger' as const },
}

/** PRO 元信息条：工商 key-value + 评级 + 健康度环 + 诊断摘要（规格 §3.2） */
export function MetaStrip({ xray }: { xray: CompanyXRay }) {
  const meta = RISK_META[xray.overallRisk]
  const t = useTokens()
  const terms = getTerms('pro')
  const color = t.riskColor[xray.overallRisk]
  const r = xray.registry

  const kv: { k: string; v: string }[] = [
    ...(r ? [{ k: terms.metaStrip.creditCode, v: r.creditCode }] : []),
    { k: '所属行业', v: xray.industry },
    ...(r ? [{ k: terms.metaStrip.foundedAt, v: r.foundedAt }] : []),
    ...(r ? [{ k: terms.metaStrip.registeredCapital, v: formatWan(r.registeredCapital) }] : []),
    { k: terms.metaStrip.asOf, v: xray.asOf.replace('T', ' ').slice(0, 16) },
  ]

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
      style={{ borderColor: `${color}66` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-50">{r?.fullName ?? xray.name}</h1>
            <span className="font-mono text-xs text-slate-500">
              {xray.stockCode ?? 'UNLISTED'} · {xray.industry}
            </span>
            <Badge variant={meta.badge} className="gap-1.5 px-3 py-1 text-xs">
              <meta.Icon className="h-3.5 w-3.5" />
              {meta.label}
            </Badge>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 md:grid-cols-3">
            {kv.map(({ k, v }) => (
              <div key={k} className="flex items-baseline justify-between gap-3 border-b border-edge/60 pb-1.5">
                <dt className="shrink-0 font-mono text-[10px] tracking-wider text-slate-500">{k}</dt>
                <dd className="truncate font-mono text-xs text-slate-200">{v}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">{xray.verdict}</p>
          <p className="mt-1.5 text-xs text-slate-400">
            <span className="font-mono text-[10px] tracking-wider text-slate-500">ADVICE </span>
            {xray.advice}
          </p>
          <div className="mt-3">
            <DataSourceBadge sources={xray.sources} />
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(${color} 0 ${xray.hp.score * 3.6}deg, ${t.colors.edge} ${xray.hp.score * 3.6}deg 360deg)` }}
          >
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-ink-card">
              <StatNumber value={xray.hp.score} className="text-2xl font-semibold text-slate-50" duration={1.2} />
              <span className="font-mono text-[9px] tracking-wider text-slate-500">{terms.healthLabel}</span>
            </div>
          </div>
          <div className="text-right" style={{ color }}>
            <StatNumber value={xray.riskScore} className="text-5xl font-bold" duration={1.5} />
            <div className="font-mono text-[10px] tracking-[0.3em] text-slate-500">{terms.riskScoreCaption}</div>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
```

- [ ] **步骤 2：验证编译**

运行：`npm run typecheck`
预期：无错误。

- [ ] **步骤 3：Commit**

```bash
git add components/xray/MetaStrip.tsx
git commit -m "feat: PRO 元信息条 MetaStrip（健康度环 + 工商 kv + 评级摘要）"
```

---

## 任务 6：NarrativeCard 与 MiniDimCard 组件（LITE）

**文件：**
- 创建：`components/xray/NarrativeCard.tsx`
- 创建：`components/xray/MiniDimCard.tsx`

- [ ] **步骤 1：实现 NarrativeCard**

新建 `components/xray/NarrativeCard.tsx`：

```tsx
'use client'

import { FileSearch } from 'lucide-react'
import { useXrayStore } from '@/lib/store'
import { getTerms } from '@/lib/theme/terms'
import { NARRATIVE_ICONS, narrativeCopy } from '@/lib/narrative-copy'
import type { CompanyXRay, HiddenStatus, NarrativeKey } from '@/lib/types'

const SEV_ORDER = { high: 0, mid: 1, low: 2 } as const

function pickEvidence(items: HiddenStatus[]): HiddenStatus | undefined {
  return [...items].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])[0]
}

/** LITE 叙事卡：图标 + 关键数字 + 一段人话 + 证据入口（规格 §5.1 E） */
export function NarrativeCard({ id, k, xray }: { id: string; k: NarrativeKey; xray: CompanyXRay }) {
  const setActiveStatus = useXrayStore((s) => s.setActiveStatus)
  const terms = getTerms('lite')
  const model = narrativeCopy(k, xray)
  const evidence = pickEvidence(xray.hiddenStatus)

  return (
    <section id={id} className="glass-card scroll-mt-24 p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-100">
        <span aria-hidden>{NARRATIVE_ICONS[k]}</span>
        {terms.dimensionTitles[k]}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-slate-50">{model.big}</span>
        <span className="font-mono text-[10px] text-slate-500">{model.caption}</span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{model.text}</p>
      {evidence && (
        <button
          onClick={() => setActiveStatus(evidence)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-btn border border-neon/40 px-3 py-1.5 font-mono text-[11px] text-neon transition-colors hover:bg-neon/10"
        >
          <FileSearch className="h-3.5 w-3.5" />
          查看证据
        </button>
      )}
    </section>
  )
}
```

- [ ] **步骤 2：实现 MiniDimCard**

新建 `components/xray/MiniDimCard.tsx`：

```tsx
'use client'

import { motion } from 'framer-motion'
import { scoreColor } from '@/lib/theme'
import { useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay, NarrativeKey } from '@/lib/types'

const DIMS: Record<Exclude<NarrativeKey, 'network'>, { score: (x: CompanyXRay) => number; sub: (x: CompanyXRay) => string }> = {
  hp: { score: (x) => x.hp.score, sub: (x) => `质押 ${x.def.pledgeRatio}%` },
  def: { score: (x) => x.def.score, sub: (x) => `质押 ${x.def.pledgeRatio}%` },
  atk: { score: (x) => x.atk.score, sub: (x) => `${x.atk.lawsuitCount} 起` },
  morale: { score: (x) => x.morale.score, sub: (x) => `tone ${x.morale.avgTone}` },
}

/** LITE 速览层迷你维度卡：标签 + 分数条 + 一行小字 */
export function MiniDimCard({ id, k, xray }: { id: string; k: NarrativeKey; xray: CompanyXRay }) {
  const t = useTokens()
  const terms = getTerms('lite')
  if (k === 'network') return null
  const dim = DIMS[k]
  const score = dim.score(xray)
  const color = scoreColor(t, score)

  return (
    <section id={id} className="glass-card scroll-mt-24 p-4">
      <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px]">
        <span className="tracking-wider text-slate-400">{terms.dimensionTitles[k]}</span>
        <span style={{ color }}>{dim.sub(xray)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-ink-bg/80">
        <motion.div
          className="h-full rounded"
          style={{ background: color, boxShadow: `0 0 8px ${color}66` }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
    </section>
  )
}
```

- [ ] **步骤 3：验证编译**

运行：`npm run typecheck`
预期：无错误。

- [ ] **步骤 4：Commit**

```bash
git add components/xray/NarrativeCard.tsx components/xray/MiniDimCard.tsx
git commit -m "feat: LITE 叙事卡与速览层迷你维度卡"
```

---

## 任务 7：图表组件 height 参数化

**文件：**
- 修改：`components/xray/CashFlowChart.tsx`
- 修改：`components/xray/LawsuitHeatmap.tsx`
- 修改：`components/xray/SentimentCurve.tsx`
- 修改：`components/xray/RelationGraph.tsx`
- 修改：`components/xray/AttributeRadar.tsx`

- [ ] **步骤 1：修改 CashFlowChart**

签名改为 `export function CashFlowChart({ hp, height = 250 }: { hp: CompanyXRay['hp']; height?: number })`；两处 `250`（`ChartEmpty height={250}` 与 `EChart height={250}`）均改为 `{height}`。

- [ ] **步骤 2：修改 LawsuitHeatmap**

签名加 `height = 220`，两处 `220` 改 `{height}`。

- [ ] **步骤 3：修改 SentimentCurve**

签名加 `height = 220`，两处 `220` 改 `{height}`。

- [ ] **步骤 4：修改 RelationGraph**

签名加 `height = 340`，`<ChartEmpty height={320}` 保持，`<EChart ... height={340}` 改 `{height}`。

- [ ] **步骤 5：修改 AttributeRadar**

签名加 `height = 250`，`<EChart ... height={250}` 改 `{height}`。

- [ ] **步骤 6：验证编译**

运行：`npm run typecheck && npx vitest run`
预期：无错误，既有测试全部 PASS。

- [ ] **步骤 7：Commit**

```bash
git add components/xray/CashFlowChart.tsx components/xray/LawsuitHeatmap.tsx components/xray/SentimentCurve.tsx components/xray/RelationGraph.tsx components/xray/AttributeRadar.tsx
git commit -m "feat: 图表组件 height 可选参数（速览层 C 位放大预备）"
```

---

## 任务 8：PRO 详读层 sections

**文件：**
- 创建：`components/xray/detail/SectionShell.tsx`
- 创建：`components/xray/detail/FinancialSection.tsx`
- 创建：`components/xray/detail/EquitySection.tsx`
- 创建：`components/xray/detail/LegalSection.tsx`
- 创建：`components/xray/detail/SentimentSection.tsx`
- 创建：`components/xray/detail/NetworkSection.tsx`
- 创建：`components/xray/detail/EvidenceSection.tsx`
- 创建：`components/xray/detail/AiSection.tsx`

- [ ] **步骤 1：实现 SectionShell**

```tsx
import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** PRO 详读层 section 容器：锚点 id + 标题 + 卡片（规格 §3.4） */
export function SectionShell({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  )
}
```

- [ ] **步骤 2：实现 FinancialSection / SentimentSection / NetworkSection**

```tsx
// FinancialSection.tsx
'use client'
import { CashFlowChart } from '../CashFlowChart'
import type { CompanyXRay } from '@/lib/types'

export function FinancialSection({ xray }: { xray: CompanyXRay }) {
  return <CashFlowChart hp={xray.hp} height={300} />
}
```

```tsx
// SentimentSection.tsx
'use client'
import { SentimentCurve } from '../SentimentCurve'
import type { CompanyXRay } from '@/lib/types'

export function SentimentSection({ xray }: { xray: CompanyXRay }) {
  return <SentimentCurve morale={xray.morale} height={280} />
}
```

```tsx
// NetworkSection.tsx
'use client'
import { RelationGraph } from '../RelationGraph'
import type { CompanyXRay } from '@/lib/types'

export function NetworkSection({ xray }: { xray: CompanyXRay }) {
  return <RelationGraph graph={xray.graph} height={380} />
}
```

- [ ] **步骤 3：实现 EquitySection（质押仪表）**

```tsx
'use client'
import { StatNumber } from '../StatNumber'
import { scoreColor } from '@/lib/theme'
import { useTokens } from '@/lib/theme/use-tokens'
import type { CompanyXRay } from '@/lib/types'

/** 股权与质押（第一期）：质押比例大数字 + 预警状态；桑基图第三期接入 */
export function EquitySection({ xray }: { xray: CompanyXRay }) {
  const t = useTokens()
  const p = xray.def.pledgeRatio
  const color = p >= 60 ? t.riskColor.red : p >= 40 ? t.riskColor.yellow : t.riskColor.green
  const status = p >= 60 ? '已爆预警线' : p >= 40 ? '逼近预警线' : '未质押警戒'

  return (
    <div className="flex items-center gap-8">
      <div>
        <div className="flex items-baseline gap-2">
          <StatNumber value={p} className="text-5xl font-extrabold" duration={1.2} />
          <span className="text-2xl font-bold" style={{ color }}>%</span>
        </div>
        <div className="mt-1 font-mono text-[11px] text-slate-500">股权质押比例 · {status}</div>
      </div>
      <div className="font-mono text-xs leading-relaxed text-slate-400">
        实控人质押占总股本 {xray.def.pledgeRatio}%<br />
        资产覆盖率 {xray.def.assetCoverage}
      </div>
    </div>
  )
}
```

- [ ] **步骤 4：实现 LegalSection（热力图 + 时间轴）**

```tsx
'use client'
import { LawsuitHeatmap } from '../LawsuitHeatmap'
import { RiskTimeline } from '../RiskTimeline'
import type { CompanyXRay } from '@/lib/types'

export function LegalSection({ xray }: { xray: CompanyXRay }) {
  return (
    <div className="space-y-6">
      <LawsuitHeatmap timeline={xray.timeline} height={240} />
      <RiskTimeline timeline={xray.timeline} />
    </div>
  )
}
```

- [ ] **步骤 5：实现 EvidenceSection 与 AiSection**

```tsx
// EvidenceSection.tsx
'use client'
import { HiddenStatusList } from '../HiddenStatusList'
import type { CompanyXRay } from '@/lib/types'

export function EvidenceSection({ xray }: { xray: CompanyXRay }) {
  return (
    <div>
      <p className="mb-4 text-xs leading-relaxed text-slate-400">
        全部风险事件与对应证据如下，点击任意条目可查看来源、日期与原文链接。
      </p>
      <HiddenStatusList items={xray.hiddenStatus} />
    </div>
  )
}
```

```tsx
// AiSection.tsx
'use client'
import { Sparkles } from 'lucide-react'

/** AI 分析占位（规格 §8）：接入 LLM 后渲染 summary + sectionNotes */
export function AiSection() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-edge py-12 text-center">
      <Sparkles className="h-6 w-6 text-slate-500" />
      <p className="text-sm text-slate-400">AI 分析能力预留 · 接入 LLM 后自动启用</p>
      <p className="font-mono text-[10px] tracking-wider text-slate-600">
        DATA FROM ENGINE · INTERPRETATION FROM AI
      </p>
    </div>
  )
}
```

- [ ] **步骤 6：验证编译**

运行：`npm run typecheck`
预期：无错误。

- [ ] **步骤 7：Commit**

```bash
git add components/xray/detail/
git commit -m "feat: PRO 详读层七个 section 容器（第一期内容 + AI 占位）"
```

---

## 任务 9：AnchorNav 组件

**文件：**
- 创建：`components/xray/AnchorNav.tsx`

- [ ] **步骤 1：实现组件**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface AnchorItem {
  id: string
  label: string
}

/**
 * PRO 锚点导航（scroll-spy）：桌面左侧竖排，<lg 退化为顶部 sticky 横向 chip 条。
 * 顺序由 detailOrder 传入（随版式变化）。
 */
export function AnchorNav({ items }: { items: AnchorItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id)
        }
      },
      { rootMargin: '-25% 0px -65% 0px' },
    )
    for (const { id } of items) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [items])

  return (
    <nav className="flex gap-2 overflow-x-auto lg:sticky lg:top-6 lg:flex-col lg:overflow-visible">
      {items.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={(e) => {
            e.preventDefault()
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          className={cn(
            'shrink-0 rounded-btn border px-3 py-2 font-mono text-[11px] transition-colors',
            active === id
              ? 'border-neon/60 bg-neon/10 text-neon'
              : 'border-edge text-slate-400 hover:border-slate-600 hover:text-slate-200',
          )}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}
```

- [ ] **步骤 2：验证编译**

运行：`npm run typecheck`
预期：无错误。

- [ ] **步骤 3：Commit**

```bash
git add components/xray/AnchorNav.tsx
git commit -m "feat: PRO 锚点导航 scroll-spy（desktop 侧栏 / mobile chip 条）"
```

---

## 任务 10：XrayClient 两层重排（核心组装）

**文件：**
- 修改：`components/xray/XrayClient.tsx`（全文重写）
- 修改：`components/xray/CharacterCard.tsx`（去 PRO 分支 + LITE 并入评级/风险分/来源角标）
- 删除：`components/xray/VerdictBanner.tsx`

- [ ] **步骤 1：CharacterCard 改为纯 LITE 角色横幅**

`components/xray/CharacterCard.tsx` 全文替换为：

```tsx
'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { HealthBar } from './HealthBar'
import { HiddenStatusList } from './HiddenStatusList'
import { StatNumber } from './StatNumber'
import { DataSourceBadge } from './DataSourceBadge'
import { AttributeRadar } from './AttributeRadar'
import { formatWan } from '@/lib/utils'
import { scoreColor } from '@/lib/theme'
import { useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

const RISK_META = {
  green: { label: '低风险 · GREEN', Icon: ShieldCheck, badge: 'safe' as const },
  yellow: { label: '中风险 · YELLOW', Icon: AlertTriangle, badge: 'warn' as const },
  red: { label: '高风险 · RED', Icon: ShieldAlert, badge: 'danger' as const },
}

function DimRow({ label, score, sub }: { label: string; score: number; sub: string }) {
  const t = useTokens()
  const color = scoreColor(t, score)
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
        <span className="tracking-wider text-slate-400">{label}</span>
        <span style={{ color }}>{sub}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-ink-bg/80">
        <motion.div
          className="h-full rounded"
          style={{ background: color, boxShadow: `0 0 8px ${color}66` }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
        />
      </div>
    </div>
  )
}

/** LITE 角色横幅：头像 + 评级 + HP 血条组 + 诊断 + 小雷达（规格 §3.2） */
export function CharacterCard({ xray }: { xray: CompanyXRay }) {
  const terms = getTerms('lite')
  const meta = RISK_META[xray.overallRisk]

  return (
    <div className="glass-card flex h-full flex-col gap-5 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card border border-neon/30 bg-neon/5 text-2xl font-bold text-neon shadow-glow">
          {xray.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold text-slate-50">{xray.name}</div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
            {xray.stockCode ?? 'UNLISTED'} · {xray.industry}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Badge variant={meta.badge} className="gap-1.5 px-2.5 py-0.5 text-[11px]">
              <meta.Icon className="h-3 w-3" />
              {meta.label}
            </Badge>
            <span className="flex items-baseline gap-1">
              <StatNumber value={xray.riskScore} className="text-xl font-bold text-slate-100" duration={1.2} />
              <span className="font-mono text-[9px] tracking-[0.2em] text-slate-500">{terms.riskScoreCaption}</span>
            </span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[13px] leading-relaxed text-slate-200">{xray.verdict}</p>
        <p className="mt-1.5 text-xs text-slate-400">
          <span className="font-mono text-[10px] tracking-wider text-neon/80">ADVICE </span>
          {xray.advice}
        </p>
      </div>

      <HealthBar hp={xray.hp} />

      <div className="space-y-3">
        <DimRow label={terms.defLabel} score={xray.def.score} sub={`${xray.def.label} · 质押 ${xray.def.pledgeRatio}%`} />
        <DimRow
          label={terms.atkLabel}
          score={xray.atk.score}
          sub={`${xray.atk.label} · 诉讼 ${xray.atk.lawsuitCount} 起 / 被执行 ${formatWan(xray.atk.executionAmount)}`}
        />
        <DimRow label={terms.moraleLabel} score={xray.morale.score} sub={`${xray.morale.label} · tone ${xray.morale.avgTone}`} />
      </div>

      <div className="mt-auto">
        <div className="mb-2.5 flex items-center justify-between font-mono text-[11px] tracking-[0.25em] text-slate-500">
          {terms.hiddenTitle}
          <span className="text-grape">
            ×<StatNumber value={xray.hiddenStatus.length} duration={0.6} />
          </span>
        </div>
        <HiddenStatusList items={xray.hiddenStatus} />
      </div>

      <div className="border-t border-edge/60 pt-4">
        <div className="mb-2 font-mono text-[10px] tracking-[0.25em] text-slate-500">{terms.cardTitles.radar}</div>
        <AttributeRadar xray={xray} height={210} />
      </div>

      <DataSourceBadge sources={xray.sources} />
    </div>
  )
}
```

删除该文件中的 `ProCard` 与 `mode` 分支。

- [ ] **步骤 2：重写 XrayClient.tsx**

```tsx
'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, GitCompareArrows } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AttributeRadar } from './AttributeRadar'
import { CashFlowChart } from './CashFlowChart'
import { CharacterCard } from './CharacterCard'
import { EvidenceDrawer } from './EvidenceDrawer'
import { LawsuitHeatmap } from './LawsuitHeatmap'
import { MiniDimCard } from './MiniDimCard'
import { NarrativeCard } from './NarrativeCard'
import { RelationGraph } from './RelationGraph'
import { SentimentCurve } from './SentimentCurve'
import { AnchorNav } from './AnchorNav'
import { MetaStrip } from './MetaStrip'
import { SectionShell } from './detail/SectionShell'
import { FinancialSection } from './detail/FinancialSection'
import { EquitySection } from './detail/EquitySection'
import { LegalSection } from './detail/LegalSection'
import { SentimentSection } from './detail/SentimentSection'
import { NetworkSection } from './detail/NetworkSection'
import { EvidenceSection } from './detail/EvidenceSection'
import { AiSection } from './detail/AiSection'
import { ShareCard } from '@/components/share/ShareCard'
import { detailOrder, glanceLayout, narrativeOf } from '@/lib/narrative'
import type { DetailSectionId, GlanceSlot } from '@/lib/narrative'
import { useMode } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay, NarrativeKey } from '@/lib/types'

const rise = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.12 + i * 0.05, duration: 0.5 } }),
}

const SLOT_KEY: Record<GlanceSlot, NarrativeKey> = {
  finance: 'hp', equity: 'def', legal: 'atk', sentiment: 'morale', network: 'network',
}

/** LITE 详读层只渲染五个维度卡（证据入口在每张卡上；ai 为 PRO 专属 section） */
const LITE_SECTION_KEY: Partial<Record<DetailSectionId, NarrativeKey>> = {
  financial: 'hp', equity: 'def', legal: 'atk', sentiment: 'morale', network: 'network',
}

/** 速览层图位 → 卡片标题（双模式术语） */
function slotTitle(slot: GlanceSlot, terms: ReturnType<typeof getTerms>): string {
  switch (slot) {
    case 'finance': return terms.cardTitles.cashflow
    case 'equity': return terms.dimensionTitles.def
    case 'legal': return terms.cardTitles.lawsuit
    case 'sentiment': return terms.cardTitles.sentiment
    case 'network': return terms.cardTitles.graph
  }
}

/** 报告页客户端容器：头（版式无关）→ 速览层（版式驱动）→ 详读层（双密度，规格 §3） */
export function XrayClient({ xray }: { xray: CompanyXRay }) {
  const mode = useMode()
  const terms = getTerms(mode)
  const narrative = narrativeOf(xray)
  const layout = glanceLayout(xray, narrative)
  const order = detailOrder(layout)

  const proCharts: Record<GlanceSlot, ReactNode> = {
    finance: <CashFlowChart hp={xray.hp} height={280} />,
    equity: <EquitySection xray={xray} />,
    legal: <LawsuitHeatmap timeline={xray.timeline} height={280} />,
    sentiment: <SentimentCurve morale={xray.morale} height={280} />,
    network: <RelationGraph graph={xray.graph} height={280} />,
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      {/* 顶栏 */}
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/"><ArrowLeft /> 重新扫描</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/compare"><GitCompareArrows /> 双公司对比</Link>
          </Button>
          <ShareCard xray={xray} />
        </div>
      </div>

      {/* 头：LITE 角色横幅 / PRO 元信息条 */}
      <motion.div variants={rise} custom={0} initial="hidden" animate="show">
        {mode === 'pro' ? <MetaStrip xray={xray} /> : <CharacterCard xray={xray} />}
      </motion.div>

      {/* 速览层（规格 §3.3） */}
      <div className="mt-6">
        {mode === 'pro' ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* C 位：2×2 放大 */}
            <motion.div variants={rise} custom={1} initial="hidden" animate="show" className="lg:col-span-2 lg:row-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>
                    {layout.c === 'radar' ? terms.cardTitles.radar : slotTitle(layout.c, terms)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {layout.c === 'radar'
                    ? <AttributeRadar xray={xray} height={560} />
                    : proCharts[layout.c]}
                </CardContent>
              </Card>
            </motion.div>
            {layout.rest.map((slot, i) => (
              <motion.div key={slot} variants={rise} custom={2 + i} initial="hidden" animate="show">
                <Card className="h-full">
                  <CardHeader><CardTitle>{slotTitle(slot, terms)}</CardTitle></CardHeader>
                  <CardContent>{proCharts[slot]}</CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          /* LITE：C 位大卡 + 3 迷你卡（其余维度取前 3，关联网络不进速览层） */
          <div className="grid gap-6 lg:grid-cols-3">
            <motion.div variants={rise} custom={1} initial="hidden" animate="show" className="lg:col-span-2">
              {layout.c === 'radar' ? (
                <Card className="h-full">
                  <CardHeader><CardTitle>{terms.cardTitles.radar}</CardTitle></CardHeader>
                  <CardContent><AttributeRadar xray={xray} height={380} /></CardContent>
                </Card>
              ) : (
                <NarrativeCard id="glance-c" k={SLOT_KEY[layout.c]} xray={xray} />
              )}
            </motion.div>
            {layout.rest
              .filter((s) => s !== 'network')
              .slice(0, 3)
              .map((slot, i) => (
                <motion.div key={slot} variants={rise} custom={2 + i} initial="hidden" animate="show">
                  <MiniDimCard id={`glance-${slot}`} k={SLOT_KEY[slot]} xray={xray} />
                </motion.div>
              ))}
          </div>
        )}
      </div>

      {/* 详读层（规格 §3.4） */}
      <div className="mt-10">
        <h2 className="mb-4 font-mono text-xs tracking-[0.3em] text-slate-500">
          {mode === 'pro' ? 'DETAIL REPORT' : '慢慢看 · 每个部分的详情'}
        </h2>

        {mode === 'pro' ? (
          <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
            <AnchorNav items={order.map((id) => ({ id, label: terms.sections[id] }))} />
            <div className="space-y-6">
              {order.map((id) => (
                <SectionShell key={id} id={id} title={terms.sections[id]}>
                  <SectionBody id={id} xray={xray} />
                </SectionShell>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {order.map((id) => {
              const k = LITE_SECTION_KEY[id]
              return k ? <NarrativeCard key={id} id={`detail-${id}`} k={k} xray={xray} /> : null
            })}
          </div>
        )}
      </div>

      <footer className="mt-10 text-center font-mono text-[11px] text-slate-600">
        HERMES · 所有结论均可点开证据溯源 · 数据仅供演示，不构成投资建议
      </footer>

      <EvidenceDrawer />
    </main>
  )
}

/** PRO section 内容（顺序由 detailOrder 版式传导） */
function SectionBody({ id, xray }: { id: DetailSectionId; xray: CompanyXRay }) {
  switch (id) {
    case 'financial': return <FinancialSection xray={xray} />
    case 'equity': return <EquitySection xray={xray} />
    case 'legal': return <LegalSection xray={xray} />
    case 'sentiment': return <SentimentSection xray={xray} />
    case 'network': return <NetworkSection xray={xray} />
    case 'evidence': return <EvidenceSection xray={xray} />
    case 'ai': return <AiSection />
  }
}
```

删除 `components/xray/VerdictBanner.tsx`（其 LITE 职责已由 CharacterCard 并入，PRO 职责已由 MetaStrip 接管）。

- [ ] **步骤 3：运行全量验证**

```bash
npm run typecheck && npm run lint && npx vitest run
```
预期：全部通过。

- [ ] **步骤 4：手动验证（dev server）**

运行：`npm run dev`，浏览器访问：
- `/report/mock-danger`：版式 = 质押告急；LITE 速览 C 位 = 护盾大卡（72% + AI 覆盖文案「押到极限」）；PRO 头 = 元信息条含工商字段；PRO 锚点首项 = 股权与质押；六小卡顺序 finance→legal→sentiment→network。
- `/report/mock-warning`：版式 = 资金告急；PRO 锚点首项 = 财务详情；元信息条缺工商字段不报错。
- `/report/mock-healthy`：版式 = 稳健均衡；C 位 = 雷达大图。
- 模式切换：版式不变，仅密度/术语变。

- [ ] **步骤 5：Commit**

```bash
git add -A components/xray/
git commit -m "feat: XrayClient 两层重排 —— 版式驱动速览层 + 双密度详读层，VerdictBanner 职责分流退役"
```

---

## 任务 11：RISK_COLOR 清理、全量验证与文档更新

**文件：**
- 修改：`lib/types.ts`（删除 RISK_COLOR）
- 修改：`docs/DOC-C-FRONTEND.md`（布局基线章节）

- [ ] **步骤 1：删除 RISK_COLOR**

`lib/types.ts` 删除 176-180 行的 `RISK_COLOR` 常量（已确认全库零引用，唯一真源是 `ThemeTokens.riskColor`）。

- [ ] **步骤 2：全量验证**

```bash
npm run typecheck && npm run lint && npx vitest run && npm run build
```
预期：全部通过。

- [ ] **步骤 3：更新 DOC-C-FRONTEND.md 布局基线**

将该文档中的现状基线 ASCII 布局图替换为：

```
顶栏（保留）
头        LITE：角色横幅(CharacterCard)   PRO：元信息条(MetaStrip)
速览层    版式驱动（lib/narrative.ts：narrativeOf → glanceLayout）
          PRO：5 图位，C 位 2×2 放大（均衡版式 = 雷达大图）
          LITE：C 位叙事大卡 + 3 迷你卡(MiniDimCard)
详读层    PRO：AnchorNav(scroll-spy) + 七 section（detail/，顺序随版式）
          LITE：叙事卡流（NarrativeCard ×5，evidence 并入网络卡）
页脚（保留）+ EvidenceDrawer（全局）
```

并在文档开头注明：`> 布局基线以 docs/superpowers/specs/2026-10-02-report-redesign-design.md 为准（2026-10-02 起替代旧基线）。`

- [ ] **步骤 4：Commit**

```bash
git add lib/types.ts docs/DOC-C-FRONTEND.md
git commit -m "chore: 清理 RISK_COLOR 死代码，DOC-C 布局基线对齐重设计规格"
```

---

## 自检记录

- **规格覆盖度（第一期 §9）**：narrativeOf + 触发器 ✓ 任务2；registry ✓ 任务1；RISK_COLOR 清理 ✓ 任务11；MetaStrip/AnchorNav/NarrativeCard ✓ 任务5/9/6；七 section 容器含 AiSection 占位 ✓ 任务8；XrayClient 两层重排 ✓ 任务10；mock 归属锁定 ✓ 任务2 集成测试；DOC-C ✓ 任务11。
- **占位符扫描**：无 TODO/待定；所有代码步骤含完整代码。
- **类型一致性**：`NarrativeType`/`NarrativeKey`/`RegistryInfo`/`LlmSummary` 均在任务1定义，任务2/4/5/6/10 引用一致；`glanceLayout`/`detailOrder` 签名与任务2测试、任务10调用一致。
