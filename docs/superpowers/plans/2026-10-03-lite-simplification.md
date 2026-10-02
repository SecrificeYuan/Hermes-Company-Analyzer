# LITE 简洁化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 按规格 `docs/superpowers/specs/2026-10-03-lite-simplification-design.md` 落地 LITE 双页简洁化——灯升首屏主角、人话术语表、debuff 层数/叠加警告、非上市照常出片、对比页付款人语言。

**架构：** 纯函数层先行（契约 `light/tier/fatal` 增量 + `deriveLight` + 质押规则三档化），UI 层随后（LightBanner/CharacterPanel 拆分/HiddenStatus 升级/对比页改造），数据层垫后（非上市逐块渲染、快照主体入口），最后全量验收。上市 analyze() 与非上市 healthToXray() 共用同一 `deriveLight`。

**技术栈：** Next.js 15 App Router、React 19、TypeScript、Tailwind、vitest、framer-motion、zustand（useXrayStore）、ECharts（自研封装）。

**既有基线（2026-10-03 实测，断言回归用）：**

| fixture | overallRisk | riskScore | debuffs |
|---|---|---|---|
| mock-healthy | green | 11 | 无 |
| mock-warning | yellow | 51 | boss-cashout:high |
| mock-danger | red | 100 | 5 条（含 pledge-pierce:high @72%） |

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `lib/types.ts` | `LightVerdict`、`HiddenStatus.tier/fatal`、`CompanyXRay.light`、`LlmSummary.lightReason` | 修改 |
| `lib/analysis/light.ts` | `deriveLight` 基准档+修饰判定、headline/reason/saferAdvice 模板 | 新建 |
| `lib/analysis/debuff/rules.ts` | 质押规则三档化（≥30 触发、30–69 mid、≥70 high、tier 输出） | 修改 |
| `lib/data/health-xray.ts` | 接 deriveLight，coverage 由 overall 映射 | 修改 |
| `lib/analysis/analyze.ts` | 返回对象挂 `light` | 修改 |
| `lib/__tests__/light.test.ts` | deriveLight 五路径 + 三档回归 + 禁用词校验 | 新建 |
| `lib/__tests__/debuff-tier.test.ts` | 质押三档 tier/severity 断言 | 新建 |
| `lib/theme/terms.ts` | LITE 词表整表重写（PRO 不动） | 修改 |
| `lib/__tests__/terms.test.ts` | LITE 词条断言更新 | 修改 |
| `components/xray/LightBanner.tsx` | 灯区通栏组件 | 新建 |
| `components/xray/CharacterPanel.tsx` | 原 CharacterCard 拆分：面板层（去徽章/verdict/debuff/雷达缩小/非上市逐块） | 新建 |
| `components/xray/CharacterCard.tsx` | 删除（被 CharacterPanel 取代） | 删除 |
| `components/xray/HiddenStatusList.tsx` | 层数刻度、中文严重度、≥3 叠加警告 | 修改 |
| `components/xray/XrayClient.tsx` | LITE 版式：灯区置顶+两列内滚；导入 CharacterPanel | 修改 |
| `components/xray/HealthBar.tsx` | "资产负债率"→"欠债是资产的 x%" | 修改 |
| `components/xray/NarrativeCard.tsx` | caption "舆论温度"→"口碑温度" | 修改 |
| `lib/narrative-copy.ts` | 同上 caption | 修改 |
| `lib/data/snapshot-subjects.ts` | 快照主体注册表（演示名单） | 新建 |
| `app/api/company/[id]/xray/route.ts` | slug id 走 findCompany+healthToXray | 修改 |
| `components/compare/CompareSelector.tsx` | "演示名单"入口、slot 类型放宽 | 修改 |
| `components/compare/CompareClient.tsx` | 骨架屏替换 BattleLoading、去 K.O./压暗、胜者角标、双方灯语卡、import CharacterPanel | 修改 |
| `components/compare/BattleLoading.tsx` | 删除（被骨架屏取代） | 删除 |
| `components/compare/CompareVerdictBar.tsx` | 比分改中文"风险分" | 修改 |

---

## P1 契约+引擎

### 任务 1：契约增量

**文件：**
- 修改：`lib/types.ts`（LightVerdict 插在 `RiskLevel` 声明后约 165 行；HiddenStatus 在 173 行；LlmSummary 在 131 行；CompanyXRay.light 在 245 行 `llm` 字段旁）

- [ ] **步骤 1：编辑 types.ts**

四处编辑，代码如下：

```ts
// ① 131 行 LlmSummary 内新增字段（接口体内追加一行）
export interface LlmSummary {
  // ...既有字段不变
  /** 灯理由的 LLM 覆写（可选）：存在时 LightBanner 优先于模板 reason */
  lightReason?: string
}

// ② 165 行 RiskLevel 声明后新增
/** 灯（LITE 首屏唯一结论，v1.1 增量可选字段） */
export interface LightVerdict {
  color: RiskLevel
  headline: string          // 固定三句：先别付这钱 / 能付，但换个付法 / 这钱能付
  reason: string            // 一句人话；llm.lightReason 存在时优先
  saferAdvice?: string      // 仅黄灯：怎么付更安全
  limitedSignals?: boolean  // 非上市"基于公开信号"诚实角标
}

// ③ 173 行 HiddenStatus 内追加两个可选字段
export interface HiddenStatus {
  // ...既有字段不变
  /** 层数刻度（v1.1 增量）：如质押 30/60/80 → { current: 2, max: 3 } */
  tier?: { current: number; max: number }
  /** 致命 debuff（v1.1 增量）：命中即红灯（无牌照/未备案招商等品类弹药） */
  fatal?: boolean
}

// ④ 245 行 CompanyXRay.llm 字段后新增
  /** 灯（v1.1 增量可选）：缺席时渲染层按 overallRisk 映射兜底 */
  light?: LightVerdict
```

- [ ] **步骤 2：类型检查**

运行：`npm run typecheck`
预期：通过（零引用破坏，全可选增量）。

- [ ] **步骤 3：Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): LightVerdict/HiddenStatus.tier/fatal/llm.lightReason 契约增量（v1.1）"
```

### 任务 2：deriveLight 纯函数（TDD）

**文件：**
- 测试：`lib/__tests__/light.test.ts`（新建）
- 实现：`lib/analysis/light.ts`（新建）

- [ ] **步骤 1：编写失败的测试**

```ts
import { describe, expect, it } from 'vitest'
import { deriveLight } from '@/lib/analysis/light'
import { LITE_BANNED_TERMS } from '@/lib/theme/terms'
import type { HiddenStatus } from '@/lib/types'

const debuff = (over: Partial<HiddenStatus> = {}): HiddenStatus => ({
  id: 'x', label: '老板套现', severity: 'mid', description: '测试描述', evidence: [],
  ...over,
})

describe('deriveLight', () => {
  it('基准档：overallRisk 三档映射固定 headline', () => {
    expect(deriveLight({ overallRisk: 'green', hiddenStatus: [], coverage: 'full' }).headline).toBe('这钱能付')
    expect(deriveLight({ overallRisk: 'yellow', hiddenStatus: [], coverage: 'full' }).headline).toBe('能付，但换个付法')
    expect(deriveLight({ overallRisk: 'red', hiddenStatus: [], coverage: 'full' }).headline).toBe('先别付这钱')
  })

  it('修饰1：fatal 命中直接红（哪怕基准绿）', () => {
    const r = deriveLight({ overallRisk: 'green', hiddenStatus: [debuff({ fatal: true })], coverage: 'full' })
    expect(r.color).toBe('red')
    expect(r.headline).toBe('先别付这钱')
  })

  it('修饰2：非 fatal ≥3 升一档（绿→黄）', () => {
    const r = deriveLight({ overallRisk: 'green', hiddenStatus: [debuff(), debuff({ id: 'y' }), debuff({ id: 'z' })], coverage: 'full' })
    expect(r.color).toBe('yellow')
    expect(r.saferAdvice).toBeTruthy()
  })

  it('修饰2：黄基准+≥3 升红', () => {
    const r = deriveLight({ overallRisk: 'yellow', hiddenStatus: [debuff(), debuff({ id: 'y' }), debuff({ id: 'z' })], coverage: 'full' })
    expect(r.color).toBe('red')
  })

  it('1–2 条命中黄灯带 saferAdvice；0 命中绿灯无 saferAdvice', () => {
    const one = deriveLight({ overallRisk: 'green', hiddenStatus: [debuff()], coverage: 'full' })
    expect(one.color).toBe('yellow')
    expect(one.saferAdvice).toBeTruthy()
    const zero = deriveLight({ overallRisk: 'green', hiddenStatus: [], coverage: 'full' })
    expect(zero.color).toBe('green')
    expect(zero.saferAdvice).toBeUndefined()
  })

  it('修饰3：覆盖不足时绿色基准压黄 + limitedSignals', () => {
    const r = deriveLight({ overallRisk: 'green', hiddenStatus: [], coverage: 'partial' })
    expect(r.color).toBe('yellow')
    expect(r.limitedSignals).toBe(true)
    expect(r.reason).toContain('不全')
  })

  it('reason/saferAdvice 零禁用术语', () => {
    const cases = [
      deriveLight({ overallRisk: 'red', hiddenStatus: [debuff({ severity: 'high' })], coverage: 'full' }),
      deriveLight({ overallRisk: 'green', hiddenStatus: [], coverage: 'partial' }),
      deriveLight({ overallRisk: 'yellow', hiddenStatus: [debuff()], coverage: 'full' }),
    ]
    for (const c of cases) {
      for (const term of LITE_BANNED_TERMS) {
        expect(`${c.headline}|${c.reason}|${c.saferAdvice ?? ''}`).not.toContain(term)
      }
    }
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run lib/__tests__/light.test.ts`
预期：FAIL，`Cannot find module '@/lib/analysis/light'`。

- [ ] **步骤 3：实现 light.ts**

```ts
import type { HiddenStatus, LightVerdict, RiskLevel } from '@/lib/types'

export type Coverage = 'full' | 'partial' | 'insufficient'

const HEADLINE: Record<RiskLevel, string> = {
  green: '这钱能付',
  yellow: '能付，但换个付法',
  red: '先别付这钱',
}

function strongest(hiddenStatus: HiddenStatus[]): HiddenStatus | undefined {
  const rank = { high: 0, mid: 1, low: 2 } as const
  return [...hiddenStatus].sort((a, b) => {
    if (!!b.fatal !== !!a.fatal) return a.fatal ? -1 : 1
    return rank[a.severity] - rank[b.severity]
  })[0]
}

function buildReason(color: RiskLevel, hiddenStatus: HiddenStatus[], limited: boolean): string {
  if (limited) return '公开资料不全，这份评估只基于查得到的信号——没查到不等于没问题。'
  const top = strongest(hiddenStatus)
  if (color === 'green') return '查得到的信号里都干净：没官司缠身、没老板套现、没质押爆点。'
  if (!top) return '有几项信号需要留心，付之前建议点开证据看一眼。'
  return hiddenStatus.length > 1
    ? `查到了 ${hiddenStatus.length} 项危险信号，最扎眼的是「${top.label}」。`
    : `有一项信号值得留心：「${top.label}」。`
}

/**
 * 灯（v1.1）：基准档 = overallRisk 映射；fatal→红；非 fatal ≥3 升一档；
 * 覆盖不足时绿色基准压黄并标 limitedSignals（"没查到"不得渲染成"干净"）。
 */
export function deriveLight(input: {
  overallRisk: RiskLevel
  hiddenStatus: HiddenStatus[]
  coverage: Coverage
}): LightVerdict {
  const { overallRisk, hiddenStatus, coverage } = input
  let color: RiskLevel = overallRisk
  const fatalHit = hiddenStatus.some((d) => d.fatal)
  const nonFatal = hiddenStatus.filter((d) => !d.fatal)
  if (fatalHit) color = 'red'
  else if (nonFatal.length >= 3 && color === 'green') color = 'yellow'
  else if (nonFatal.length >= 3 && color === 'yellow') color = 'red'
  const limited = coverage !== 'full' && color === 'green'
  if (limited) color = 'yellow'
  const saferAdvice = color === 'yellow'
    ? limited
      ? '先小额试一单，或选月付；大额付出去之前，把工商登记和经营备案再查一遍。'
      : '别一次付清——改月付或分期，把单笔损失锁到最小。'
    : undefined
  return {
    color,
    headline: HEADLINE[color],
    reason: buildReason(color, hiddenStatus, limited),
    saferAdvice,
    limitedSignals: limited || undefined,
  }
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run lib/__tests__/light.test.ts`
预期：7 项全 PASS。

- [ ] **步骤 5：Commit**

```bash
git add lib/analysis/light.ts lib/__tests__/light.test.ts
git commit -m "feat(analysis): deriveLight 灯判定纯函数——基准档+fatal/叠加/覆盖修饰"
```

### 任务 3：质押规则三档化 + tier 输出（TDD）

**文件：**
- 测试：`lib/__tests__/debuff-tier.test.ts`（新建）
- 修改：`lib/analysis/debuff/rules.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
import { describe, expect, it } from 'vitest'
import { detectHiddenStatus } from '@/lib/analysis/debuff/rules'
import type { RawCompanyData } from '@/lib/types'

const rawWithPledge = (amount: number): RawCompanyData => ({
  meta: { id: 't', name: '测试', fetchedAt: '2026-10-01T00:00:00Z', sources: [] },
  people: [{ name: '大股东', event: '质押', amount, date: '2026-09-01' }],
} as unknown as RawCompanyData)

describe('质押三档', () => {
  it('30–39%：触发、mid、tier 1/3', () => {
    const [d] = detectHiddenStatus(rawWithPledge(35), new Date('2026-10-01'))
    expect(d).toMatchObject({ id: 'pledge-pierce', severity: 'mid', tier: { current: 1, max: 3 } })
  })

  it('40–69%：触发、mid、tier 2/3', () => {
    const [d] = detectHiddenStatus(rawWithPledge(45), new Date('2026-10-01'))
    expect(d).toMatchObject({ id: 'pledge-pierce', severity: 'mid', tier: { current: 2, max: 3 } })
  })

  it('≥70%：触发、high、tier 3/3', () => {
    const [d] = detectHiddenStatus(rawWithPledge(72), new Date('2026-10-01'))
    expect(d).toMatchObject({ id: 'pledge-pierce', severity: 'high', tier: { current: 3, max: 3 } })
  })

  it('<30% 与无质押事件：不触发', () => {
    expect(detectHiddenStatus(rawWithPledge(20), new Date('2026-10-01'))).toHaveLength(0)
    expect(detectHiddenStatus(rawWithPledge(0), new Date('2026-10-01'))).toHaveLength(0)
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run lib/__tests__/debuff-tier.test.ts`
预期：FAIL（35%/45% 用例拿不到 pledge-pierce——现阈值 ≥70）。

- [ ] **步骤 3：修改 rules.ts**

`DebuffRule` 接口加可选 `tier?: (evidence: Evidence) => { current: number; max: number } | undefined`——不，更简单：让 `detect` 返回带 tier 的结果会侵入所有规则。**最小改法**：接口加可选字段 `tierOf?: (amount: number) => ...` 过度设计。采用直接方案——`detectHiddenStatus` 里 rule 产物 push 时附 `tier: rule.tier?.()`，仅质押规则定义 `tier`。

```ts
interface DebuffRule {
  id: string
  label: string
  severity: Severity
  description: string
  /** 层数刻度（v1.1 增量）：规则触发时附到 HiddenStatus.tier */
  tier?: { current: number; max: number }
  detect(raw: RawCompanyData, asOf: Date): Evidence | null
}
```

质押规则整体替换（阈值 ≥30、severity 按档、evidence detail 带档）：

```ts
  {
    id: 'pledge-pierce',
    label: '股权质押穿透',
    severity: 'high', // 运行期按档位覆盖为 mid，见 detect
    description: '控股股东质押达 30% 即入列，70% 以上随时可能被强制平仓、公司易主',
    detect(raw) {
      const events = pledgeEvents(raw).filter((p) => (p.amount ?? 0) >= 30)
      if (events.length === 0) return null
      return events.map((p) => {
        const amount = p.amount ?? 0
        const tier = amount >= 70 ? { current: 3, max: 3 } : amount >= 40 ? { current: 2, max: 3 } : { current: 1, max: 3 }
        return {
          source: '股权质押',
          date: p.date,
          detail: `${p.name}（${p.role}）累计质押比例达 ${amount}%`,
          // 附件通过闭包传出：在 detect 外层拿最后一条的 amount 定 severity/tier
        }
      })
    },
  },
```

severity/tier 需要跟 evidence 走——把 push 逻辑改为 rule 返回 `(HiddenStatus & { evidence: Evidence })` 太重。**采用最直白改法**：`detect` 签名不变，`DebuffRule` 加 `severityOf?: (evidence: Evidence) => Severity` 与 `tierOf?: (evidence: Evidence) => { current: number; max: number } | undefined`；`detectHiddenStatus` push 时：

```ts
    results.push({
      id: rule.id,
      label: rule.label,
      severity: rule.severityOf ? rule.severityOf(evidence) : rule.severity,
      description: rule.description,
      tier: rule.tierOf ? rule.tierOf(evidence) : undefined,
      evidence,
    })
```

质押规则定义：

```ts
  {
    id: 'pledge-pierce',
    label: '股权质押穿透',
    severity: 'high',
    description: '控股股东质押达 30% 即入列，70% 以上随时可能被强制平仓、公司易主',
    severityOf: (evidence) => (Number(evidence[0]?.detail.match(/(\d+)%/)?.[1] ?? 0) >= 70 ? 'high' : 'mid'),
    tierOf: (evidence) => {
      const amount = Number(evidence[0]?.detail.match(/(\d+)%/)?.[1] ?? 0)
      return amount >= 70 ? { current: 3, max: 3 } : amount >= 40 ? { current: 2, max: 3 } : { current: 1, max: 3 }
    },
    detect(raw) {
      const events = pledgeEvents(raw).filter((p) => (p.amount ?? 0) >= 30)
      if (events.length === 0) return null
      return events.map((p) => ({
        source: '股权质押',
        date: p.date,
        detail: `${p.name}（${p.role}）累计质押比例达 ${p.amount}%`,
      }))
    },
  },
```

- [ ] **步骤 4：运行测试 + 全量回归**

运行：`npx vitest run lib/__tests__/debuff-tier.test.ts && npm run test`
预期：新测试 PASS；全量绿，**重点确认 mock-healthy/warning/danger 三档不劣化**（warning 新增 pledge-pierce:mid@45%、riskScore 51→56，仍为 yellow）。若 warning 翻红，停止并回查本步骤 severity 映射。

- [ ] **步骤 5：Commit**

```bash
git add lib/analysis/debuff/rules.ts lib/__tests__/debuff-tier.test.ts
git commit -m "feat(analysis): 质押规则三档化——≥30 触发、mid/high 按档、tier 1-3/3 输出"
```

### 任务 4：analyze() 挂 light（TDD）

**文件：**
- 测试：`lib/__tests__/light.test.ts`（追加 describe）
- 修改：`lib/analysis/analyze.ts`

- [ ] **步骤 1：追加失败测试**

```ts
import { analyze } from '@/lib/analysis/analyze'
import dangerJson from '@/data/mock/company-danger.json'
import warningJson from '@/data/mock/company-warning.json'
import healthyJson from '@/data/mock/company-healthy.json'
const raw = (j: unknown) => j as RawCompanyData // 顶部已有则复用

describe('analyze 挂灯（三档回归 + 灯断言）', () => {
  it('healthy→绿灯能付；warning→黄灯带 saferAdvice；danger→红灯先别付', () => {
    const h = analyze(raw(healthyJson))
    expect(h.overallRisk).toBe('green')
    expect(h.light).toMatchObject({ color: 'green', headline: '这钱能付' })
    const w = analyze(raw(warningJson))
    expect(w.overallRisk).toBe('yellow')
    expect(w.light).toMatchObject({ color: 'yellow', headline: '能付，但换个付法' })
    expect(w.light?.saferAdvice).toBeTruthy()
    expect(w.hiddenStatus.find((d) => d.id === 'pledge-pierce')?.tier).toEqual({ current: 2, max: 3 })
    const d = analyze(raw(dangerJson))
    expect(d.overallRisk).toBe('red')
    expect(d.light).toMatchObject({ color: 'red', headline: '先别付这钱' })
  })
})
```

- [ ] **步骤 2：运行确认失败**

运行：`npx vitest run lib/__tests__/light.test.ts`
预期：FAIL，`h.light` 为 undefined。

- [ ] **步骤 3：修改 analyze.ts**

import 与 return 各加一行：

```ts
import { deriveLight } from './light'
// return 对象内、advice 之后：
    light: deriveLight({ overallRisk, hiddenStatus, coverage: 'full' }),
```

- [ ] **步骤 4：运行确认通过**

运行：`npx vitest run lib/__tests__/light.test.ts`
预期：全 PASS。

- [ ] **步骤 5：Commit**

```bash
git add lib/analysis/analyze.ts lib/__tests__/light.test.ts
git commit -m "feat(analysis): analyze() 输出 light（上市恒 full 覆盖）"
```

### 任务 5：healthToXray 接 light（TDD）

**文件：**
- 测试：`lib/__tests__/light.test.ts`（追加）
- 修改：`lib/data/health-xray.ts`

- [ ] **步骤 1：追加失败测试**

```ts
import { healthToXray } from '@/lib/data/health-xray'
import type { CompanyHealth } from '@/lib/company'

const healthOf = (overall: 'partial' | 'insufficient', financialRisk: 'low' | 'medium' | 'high' | null): CompanyHealth => ({
  company: { id: 'gym-1', name: '测试健身房', listing: 'unlisted', identity: 'lead', sources: [] },
  asOf: '2026-10-01T00:00:00Z',
  financialYear: null, years: [],
  metrics: { revenueGrowth: null, netMargin: null, debtRatio: null, currentRatio: null, netProfit: null, operatingCashFlow: null, pledgeRatio: null, lawsuitAnnouncements: null, executionAnnouncements: null },
  financialRisk, riskReasons: financialRisk ? ['测试原因'] : [], overall, gaps: ['财务报表'],
  investment: { status: 'needs_due_diligence', annualizedReturn: null, reason: '资料不足，无法给出回报率。' },
  sources: [],
} as unknown as CompanyHealth)

describe('非上市灯（healthToXray）', () => {
  it('覆盖不足时绿色基准压黄 + limitedSignals', () => {
    const x = healthToXray(healthOf('insufficient', 'low'))
    expect(x.light).toMatchObject({ color: 'yellow', limitedSignals: true })
    expect(x.light?.reason).toContain('不全')
  })
  it('覆盖 partial 同理压黄', () => {
    expect(healthToXray(healthOf('partial', 'low')).light?.color).toBe('yellow')
  })
})
```

- [ ] **步骤 2：运行确认失败**——`light` undefined。
- [ ] **步骤 3：修改 health-xray.ts**

```ts
import { deriveLight, type Coverage } from '@/lib/analysis/light'
// return 对象内、advice 之后：
    light: deriveLight({
      overallRisk: risk,
      hiddenStatus: [],
      coverage: (report.overall === 'partial' ? 'partial' : 'insufficient') as Coverage,
    }),
```

（非上市 hiddenStatus 本期由信号引擎快照层另案填充，见规格 Out of Scope；此处空数组走覆盖度修饰。）

- [ ] **步骤 4：运行确认通过**

运行：`npx vitest run lib/__tests__/light.test.ts`
预期：全 PASS。

- [ ] **步骤 5：Commit**

```bash
git add lib/data/health-xray.ts lib/__tests__/light.test.ts
git commit -m "feat(health-xray): 非上市主体接 deriveLight——覆盖不足压黄+limitedSignals"
```

---

## P2 词表+报告页

### 任务 6：terms.ts LITE 词表重写（TDD）

**文件：**
- 测试：`lib/__tests__/terms.test.ts`（LITE 断言更新，PRO 断言不动）
- 修改：`lib/theme/terms.ts`（LITE 常量）

- [ ] **步骤 1：更新测试断言（先红）**

`terms.test.ts` 中三个 LITE 用例改为：

```ts
  it('LITE 人话术语', () => {
    const lite = getTerms('lite')
    expect(lite.healthLabel).toBe('钱袋子')
    expect(lite.defLabel).toBe('护盾 · 质押')
    expect(lite.atkLabel).toBe('麻烦 · 官司')
    expect(lite.moraleLabel).toBe('口碑')
    expect(lite.hiddenTitle).toBe('隐藏状态')
    expect(lite.riskScoreCaption).toBe('风险分')
    expect(lite.radarSeriesName).toBe('五维体征')
    expect(lite.cardTitles.radar).toBe('五维体征')
    expect(lite.sections).toMatchObject({ financial: '钱袋子', equity: '护盾', legal: '麻烦', sentiment: '口碑', network: '关系网' })
  })

  it('LITE 对比页术语', () => {
    const c = getTerms('lite').compare
    expect(c.title).toBe('两家公司比比看')
    expect(c.action).toBe('开始对比')
    expect(c.winnerTemplate).toBe('这钱付给 {name} 更稳')
    expect(c.drawLabel).toBe('两家差不多')
    expect(c.slotLabel).toBe('公司 {slot}')
    expect(c.verdictQuoteTitle).toBe('两边各一句')
    expect(c.idleHint).toBe('选两家公司，看看钱付给谁更稳')
  })
```

- [ ] **步骤 2：运行确认失败**

运行：`npx vitest run lib/__tests__/terms.test.ts`
预期：3 个 LITE 用例 FAIL。

- [ ] **步骤 3：重写 terms.ts LITE 常量**

```ts
const LITE: Terms = {
  healthLabel: '钱袋子',
  defLabel: '护盾 · 质押',
  atkLabel: '麻烦 · 官司',
  moraleLabel: '口碑',
  hiddenTitle: '隐藏状态',
  riskScoreCaption: '风险分',
  radarIndicators: ['血量', '护盾', '麻烦', '口碑', '稳健'],
  radarSeriesName: '五维体征',
  cardTitles: {
    radar: '五维体征',
    cashflow: '经营现金流趋势',
    lawsuit: '诉讼热力图',
    sentiment: '舆情情绪曲线',
    timeline: '风险时间轴 · 近 12 个月',
    graph: '关系图谱',
  },
  sections: {
    financial: '钱袋子',
    equity: '护盾',
    legal: '麻烦',
    sentiment: '口碑',
    network: '关系网',
    evidence: '证据与来源',
    ai: '智能解读',
  },
  metaStrip: { creditCode: '信用代码', foundedAt: '成立日期', registeredCapital: '注册资本', asOf: '分析基准时', sources: '数据来源' },
  narrativeTitles: { debt: '血量告急', pledge: '护盾告急', lawsuit: '麻烦缠身', sentiment: '人心浮动', balanced: '体征平稳' },
  dimensionTitles: { hp: '钱袋子', def: '护盾', atk: '麻烦', morale: '口碑', network: '关系网' },
  compare: {
    title: '两家公司比比看',
    action: '开始对比',
    actionLoading: '分析中…',
    winnerTemplate: '这钱付给 {name} 更稳',
    drawLabel: '两家差不多',
    idleHint: '选两家公司，看看钱付给谁更稳',
    slotLabel: '公司 {slot}',
    copyLink: '复制对比链接',
    copied: '已复制 ✓',
    retry: '重试',
    sameCompanyHint: '请选择两家不同的公司',
    verdictQuoteTitle: '两边各一句',
    cardTitles: { table: '关键指标对比', trend: '趋势对决', risk: '风险状态对决' },
    llmTitle: 'AI 深度对比',
    llmHint: '大模型多维归因 · 即将上线',
  },
}
```

- [ ] **步骤 4：运行确认通过 + 反向校验仍在**

运行：`npx vitest run lib/__tests__/terms.test.ts`
预期：全 PASS（含"LITE 文案零禁用术语"反向校验）。

- [ ] **步骤 5：Commit**

```bash
git add lib/theme/terms.ts lib/__tests__/terms.test.ts
git commit -m "feat(terms): LITE 人话词表——钱袋子/护盾/麻烦/口碑/关系网、对比付款人语言"
```

### 任务 7：LightBanner 组件

**文件：**
- 新建：`components/xray/LightBanner.tsx`

- [ ] **步骤 1：编写组件**

```tsx
'use client'

import { FileSearch, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useXrayStore } from '@/lib/store'
import { useTokens } from '@/lib/theme/use-tokens'
import type { CompanyXRay } from '@/lib/types'

const META = {
  green: { Icon: ShieldCheck },
  yellow: { Icon: AlertTriangle },
  red: { Icon: ShieldAlert },
} as const

const SEV_ORDER = { high: 0, mid: 1, low: 2 } as const

/**
 * LITE 首屏灯区：全页唯一结论。headline 固定三句，reason 一句人话，
 * 黄灯附"怎么付更安全"。light 缺席（旧数据）时按 overallRisk 映射兜底。
 */
export function LightBanner({ xray }: { xray: CompanyXRay }) {
  const t = useTokens()
  const setActiveStatus = useXrayStore((s) => s.setActiveStatus)
  const light = xray.light ?? {
    color: xray.overallRisk,
    headline: xray.overallRisk === 'red' ? '先别付这钱' : xray.overallRisk === 'yellow' ? '能付，但换个付法' : '这钱能付',
    reason: xray.verdict.split('。')[0] + '。',
    limitedSignals: undefined,
  }
  const color = t.riskColor[light.color]
  const { Icon } = META[light.color]
  const evidence = [...xray.hiddenStatus].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])[0]

  return (
    <section className="glass-card mb-6 shrink-0 p-6" role="status" aria-live="polite"
      style={{ borderColor: `${color}55`, boxShadow: `0 0 32px ${color}22` }}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: `${color}1A`, border: `2px solid ${color}` }}>
            <Icon className="h-5 w-5" style={{ color }} />
            <span className="absolute inset-0 animate-ping rounded-full opacity-20" style={{ background: color }} />
          </span>
          <span className="text-2xl font-extrabold tracking-wide text-slate-50">{light.headline}</span>
          {light.limitedSignals && (
            <span className="rounded-btn border border-warn/40 px-2 py-0.5 font-mono text-[10px] text-warn">基于公开信号</span>
          )}
        </span>
        <span className="min-w-0 flex-1 basis-64 text-sm leading-relaxed text-slate-300">
          {xray.llm?.lightReason ?? light.reason}
        </span>
        {evidence && (
          <Button variant="ghost" size="sm" onClick={() => setActiveStatus(evidence)}>
            <FileSearch /> 查看证据
          </Button>
        )}
      </div>
      {light.saferAdvice && (
        <p className="mt-3 border-t border-edge pt-3 text-sm text-slate-300">
          <span className="font-mono text-[10px] tracking-[0.2em] text-neon/80">怎么付更安全 </span>
          {light.saferAdvice}
        </p>
      )}
    </section>
  )
}
```

- [ ] **步骤 2：类型检查**

运行：`npm run typecheck`
预期：通过。

- [ ] **步骤 3：Commit**

```bash
git add components/xray/LightBanner.tsx
git commit -m "feat(xray): LightBanner 灯区组件——大字结论+人话理由+黄灯建议+证据入口"
```

### 任务 8：CharacterPanel 拆分 + XrayClient LITE 版式

**文件：**
- 新建：`components/xray/CharacterPanel.tsx`
- 删除：`components/xray/CharacterCard.tsx`
- 修改：`components/xray/XrayClient.tsx`
- 修改：`components/compare/CompareClient.tsx`（仅 import CharacterCard→CharacterPanel）

- [ ] **步骤 1：新建 CharacterPanel.tsx**

由现 CharacterCard 改造：删徽章行（RISK_META/Badge/StatNumber）、删 verdict/ADVICE 段、删"暂不生成健康分数"墙、右栏雷达+debuff 移出（雷达缩 140px 放左列底部；debuff 由 XrayClient 右列直出）；health 分支逐块渲染。

```tsx
'use client'

import { HealthBar } from './HealthBar'
import { StatNumber } from './StatNumber'
import { DataSourceBadge } from './DataSourceBadge'
import { AttributeRadar } from './AttributeRadar'
import { formatWan } from '@/lib/utils'
import { scoreColor } from '@/lib/theme'
import { useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'
import type { CompanyHealth } from '@/lib/company'
import { listingLabels } from '@/lib/company'

function DimRow({ label, score, sub, unavailable = false }: { label: string; score: number; sub: string; unavailable?: boolean }) {
  const t = useTokens()
  const color = scoreColor(t, score)
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
        <span className="tracking-wider text-slate-400">{label}</span>
        <span style={{ color }}>{sub}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-ink-bg/80">
        {unavailable ? <div className="h-full border border-dashed border-edge" /> : (
          <div className="h-full rounded" style={{ background: color, boxShadow: `0 0 8px ${color}66`, width: `${score}%` }} />
        )}
      </div>
    </div>
  )
}

function MissingBlock({ label }: { label: string }) {
  return (
    <div className="rounded-btn border border-dashed border-edge px-3 py-2 text-xs text-slate-500">
      {label}这块没查到——没查到不等于没问题
    </div>
  )
}

/** LITE 面板层：身份+血条+维度条+小雷达+数据源；灯与 debuff 由 XrayClient 直出 */
export function CharacterPanel({ xray, health }: { xray: CompanyXRay; health?: CompanyHealth }) {
  const terms = getTerms('lite')
  return (
    <div className="glass-card p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card border border-neon/30 bg-neon/5 text-2xl font-bold text-neon shadow-glow">
          {xray.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold text-slate-50">{xray.name}</div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
            {health ? listingLabels[health.company.listing] : xray.stockCode ?? 'UNLISTED'} · {xray.industry}
          </div>
          {!health && (
            <div className="mt-1.5 flex items-baseline gap-1">
              <StatNumber value={xray.riskScore} className="text-base font-bold text-slate-100" duration={1.2} />
              <span className="font-mono text-[9px] tracking-[0.2em] text-slate-500">{terms.riskScoreCaption}</span>
            </div>
          )}
        </div>
      </div>

      {!health && (
        <div className="mt-5 space-y-5">
          <HealthBar hp={xray.hp} />
          <div className="space-y-3">
            <DimRow label={terms.defLabel} score={xray.def.score} sub={`${xray.def.label} · 质押 ${xray.def.pledgeRatio}%`} />
            <DimRow label={terms.atkLabel} score={xray.atk.score} sub={xray.atk.available === false ? '司法数据暂未接入' : `${xray.atk.label} · 官司 ${xray.atk.lawsuitCount} 起 / 被执行 ${formatWan(xray.atk.executionAmount)}`} unavailable={xray.atk.available === false} />
            <DimRow label={terms.moraleLabel} score={xray.morale.score} sub={xray.morale.available === false ? '新闻加载中' : `${xray.morale.label} · 口碑 ${xray.morale.avgTone}`} unavailable={xray.morale.available === false} />
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] tracking-[0.25em] text-slate-500">{terms.cardTitles.radar}</div>
            <AttributeRadar xray={xray} height={140} />
          </div>
        </div>
      )}

      {health && (
        <div className="mt-5 space-y-3">
          {health.years.length || health.metrics.operatingCashFlow !== null ? <HealthBar hp={xray.hp} /> : <MissingBlock label="财务" />}
          {health.metrics.pledgeRatio !== null ? <DimRow label={terms.defLabel} score={xray.def.score} sub={`质押 ${health.metrics.pledgeRatio}%`} /> : <MissingBlock label="质押" />}
          {health.metrics.lawsuitAnnouncements !== null ? <DimRow label={terms.atkLabel} score={xray.atk.score} sub={`官司 ${health.metrics.lawsuitAnnouncements} 起（公告线索）`} /> : <MissingBlock label="司法" />}
          <MissingBlock label="口碑" />
          {health.gaps.length > 0 && (
            <p className="text-xs text-warn">还缺：{health.gaps.join('；')}</p>
          )}
        </div>
      )}

      <div className="mt-5">
        <DataSourceBadge sources={xray.sources} />
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：XrayClient.tsx LITE 分支重排**

LITE 返回结构改为（PRO 分支全部不动）：

```tsx
      {/* LITE：顶栏 → 灯区 → 两列内滚（左面板 / 右 debuff+叙事卡） */}
      {mode === 'lite' && (
        <>
          <div className="mb-4 flex shrink-0 items-center justify-between">
            <Button asChild variant="ghost" size="sm">
              <Link href="/"><ArrowLeft /> 重新扫描</Link>
            </Button>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/compare"><GitCompareArrows /> 双公司对比</Link>
              </Button>
              {!health && <ShareCard xray={xray} />}
            </div>
          </div>
          <motion.div variants={rise} custom={0} initial="hidden" animate="show">
            <LightBanner xray={displayXray} />
          </motion.div>
          <div className="grid min-h-0 flex-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,350px)]">
            <motion.div variants={rise} custom={1} initial="hidden" animate="show" className="min-h-0 min-w-0 lg:overflow-y-auto">
              <CharacterPanel xray={displayXray} health={health} />
            </motion.div>
            <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto pr-1">
              {displayXray.hiddenStatus.length >= 3 && (
                <div className="rounded-btn border border-danger/50 bg-danger/10 px-3 py-2 text-xs text-danger">
                  ⚠ 多重负面状态叠加，情况危险
                </div>
              )}
              <div>
                <div className="mb-2.5 flex items-center justify-between font-mono text-[11px] tracking-[0.25em] text-slate-500">
                  {terms.hiddenTitle}
                  <span className="text-grape">×{displayXray.hiddenStatus.length}</span>
                </div>
                <div className="max-h-72 overflow-y-auto pr-1">
                  <HiddenStatusList items={displayXray.hiddenStatus} />
                </div>
              </div>
              {order.map((id, i) => {
                const k = LITE_SECTION_KEY[id]
                return k ? (
                  <motion.div key={id} variants={rise} custom={2 + i} initial="hidden" animate="show">
                    <NarrativeCard id={`detail-${id}`} k={k} xray={displayXray} compact />
                  </motion.div>
                ) : null
              })}
            </div>
          </div>
        </>
      )}
```

同时：删除旧 LITE 顶栏块与旧 Hero grid 块；导入 `LightBanner` 与 `CharacterPanel`，移除 `CharacterCard`/`AttributeRadar`/`EvidenceDrawer` 中不再使用的导入（EvidenceDrawer 保留）。main 容器类名 LITE 分支不变（flex h-[calc(100vh-2.25rem)] flex-col overflow-hidden）。

- [ ] **步骤 3：CompareClient.tsx 改 import**

```ts
import { CharacterPanel } from '@/components/xray/CharacterPanel'
// LiteArena 内 <CharacterCard xray={a} /> → <CharacterPanel xray={a} />（两处）
```

- [ ] **步骤 4：删除旧组件 + 全量验证**

```bash
rm components/xray/CharacterCard.tsx
npm run typecheck && npm run test && npm run build
```
预期：全绿。

- [ ] **步骤 5：Commit**

```bash
git add -A
git commit -m "feat(xray): LITE 版式重排——灯区置顶+两列内滚，CharacterCard 拆为 CharacterPanel"
```

### 任务 9：HiddenStatusList 升级

**文件：**
- 修改：`components/xray/HiddenStatusList.tsx`

- [ ] **步骤 1：整体替换**

```tsx
'use client'

import { Ghost } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useXrayStore } from '@/lib/store'
import type { HiddenStatus } from '@/lib/types'

const SEV_LABEL = { high: '高危', mid: '注意', low: '轻微' } as const
const SEV_VARIANT = { high: 'danger', mid: 'warn', low: 'dim' } as const

function TierPips({ tier }: { tier: { current: number; max: number } }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`层数 ${tier.current}/${tier.max}`}>
      {Array.from({ length: tier.max }, (_, i) => (
        <span key={i} className={`h-2.5 w-1.5 rounded-sm ${i < tier.current ? 'bg-grape' : 'bg-ink-bg/80 border border-edge'}`} />
      ))}
      <span className="ml-1 font-mono text-[10px] text-grape">{tier.current}/{tier.max} 层</span>
    </span>
  )
}

/** 隐藏状态列表：人话标题+中文严重度+层数刻度；点击开证据抽屉 */
export function HiddenStatusList({ items }: { items: HiddenStatus[] }) {
  const setActive = useXrayStore((s) => s.setActiveStatus)

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-safe/30 bg-safe/5 p-4 text-center font-mono text-xs text-safe">
        ✓ 没发现隐藏状态——干净得不像实力派
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {items.map((d) => (
        <button key={d.id} onClick={() => setActive(d)} className="glass-card glass-card-hover group w-full p-3.5 text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Ghost className="h-4 w-4 text-grape" />
              {d.label}
            </span>
            <span className="flex items-center gap-2">
              {d.tier && <TierPips tier={d.tier} />}
              <Badge variant={SEV_VARIANT[d.severity]}>{SEV_LABEL[d.severity]}</Badge>
            </span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">{d.description}</p>
          <div className="mt-2 font-mono text-[10px] text-neon/60 opacity-0 transition-opacity group-hover:opacity-100">
            ▸ 点击查看 {d.evidence.length} 条证据
          </div>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **步骤 2：类型检查 + Commit**

```bash
npm run typecheck
git add components/xray/HiddenStatusList.tsx
git commit -m "feat(xray): debuff 卡升级——层数刻度+中文严重度（高危/注意/轻微）"
```

### 任务 10：HealthBar/NarrativeCard/narrative-copy 文案除漏

**文件：**
- 修改：`components/xray/HealthBar.tsx`（底部网格）
- 修改：`lib/narrative-copy.ts`（morale caption）
- 修改：`components/xray/NarrativeCard.tsx`（仅当 caption 硬编码时；实际在 narrative-copy）

- [ ] **步骤 1：HealthBar 替换底部两格**

```tsx
      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-400">
        <div>
          经营现金流 <span className={hp.cashFlow < 0 ? 'text-danger' : 'text-safe'}>{formatWan(hp.cashFlow)}</span>
        </div>
        <div className="text-right">
          欠债是资产的 <span className={hp.debtRatio > 70 ? 'text-danger' : 'text-slate-200'}>{hp.debtRatio}%</span>
        </div>
      </div>
```

- [ ] **步骤 2：narrative-copy.ts morale caption**

```ts
        caption: '口碑温度（-10 ~ +10）',
```

- [ ] **步骤 3：验证 + Commit**

```bash
npx vitest run lib/__tests__/narrative-copy.test.ts lib/__tests__/terms.test.ts
git add components/xray/HealthBar.tsx lib/narrative-copy.ts components/xray/NarrativeCard.tsx
git commit -m "fix(copy): 负债率改'欠债是资产的x%'、caption 口碑温度——禁用词除漏"
```

---

## P3 非上市+对比页

### 任务 11：快照主体注册表 + xray API slug + 选择器入口

**文件：**
- 新建：`lib/data/snapshot-subjects.ts`
- 修改：`app/api/company/[id]/xray/route.ts`
- 修改：`components/compare/CompareSelector.tsx`
- 修改：`components/compare/CompareClient.tsx`（slot 类型放宽）

- [ ] **步骤 1：注册表**

```ts
/** 非上市演示主体（人工采集快照，PRD 黑客松十家量级）；信号引擎快照落地后替换为同一注册表 */
export interface SnapshotSubject {
  id: string        // slug，URL 与 API 共用
  name: string      // 展示名
  tag: string       // 身份标签，如 "健身房 · 快照"
}

export const SNAPSHOT_SUBJECTS: SnapshotSubject[] = [
  { id: 'mock-gym-danger', name: '鲸川健身（演示）', tag: '健身房 · 快照' },
  { id: 'mock-franchise-unfiled', name: '茶屿加盟（演示）', tag: '加盟品牌 · 快照' },
  { id: 'mock-wealth-unlicensed', name: '恒润理财（演示）', tag: '理财公司 · 快照' },
]
```

- [ ] **步骤 2：xray API 兼容 slug**

```ts
import { getXRay } from '@/lib/get-xray'
import { CompanyNotFoundError } from '@/lib/data/fetcher'
import { findCompany, getCompanyHealth } from '@/lib/data/company-health'
import { healthToXray } from '@/lib/data/health-xray'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    if (/^\d{6}$/.test(id)) return NextResponse.json(await getXRay(id))
    // 非 6 位：非上市快照主体（slug），走健康评估管线，同报告页语义
    const company = await findCompany(id)
    if (!company) return NextResponse.json({ error: 'COMPANY_NOT_FOUND', id }, { status: 404 })
    return NextResponse.json(healthToXray(await getCompanyHealth(company)))
  } catch (e) {
    if (e instanceof CompanyNotFoundError) {
      return NextResponse.json({ error: 'COMPANY_NOT_FOUND', id }, { status: 404 })
    }
    console.error('[xray] 生成失败:', e)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
```

- [ ] **步骤 3：CompareSelector 加"演示名单"入口、slot 类型放宽**

`CompareClient.tsx` 顶部：

```ts
import { SNAPSHOT_SUBJECTS, type SnapshotSubject } from '@/lib/data/snapshot-subjects'
type SlotPick = { id: string; name: string; sub?: string }
// useState<Record<Slot, ListedCompany | null>> 改 useState<Record<Slot, SlotPick | null>>
// initialPick 回填处同步改 SlotPick 形状
```

`CompareSelector.tsx`：

```tsx
// props: value: Record<Slot, SlotPick | null>；新增 onPickSnapshot: (slot: Slot, subject: SnapshotSubject) => void
// picked 分支：sub 徽标——picked.sub ?? picked.stockCode
// 未选分支：CompanySearchInput 保持 + 其下加演示名单下拉：
<select
  aria-label={`从演示名单选择公司 ${slot}`}
  disabled={loading}
  defaultValue=""
  onChange={(e) => {
    const s = SNAPSHOT_SUBJECTS.find((x) => x.id === e.target.value)
    if (s) onPickSnapshot(slot, s)
  }}
  className="mt-1 rounded-btn border border-edge bg-ink-card px-2 py-1.5 font-mono text-[11px] text-slate-400"
>
  <option value="" disabled>演示名单（非上市公司）…</option>
  {SNAPSHOT_SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.tag}</option>)}
</select>
```

按钮图标：`{mode === 'pro' ? <GitCompareArrows /> : <GitCompareArrows />}`（双模式统一，Swords 导入删除）。

- [ ] **步骤 4：验证 + Commit**

```bash
npm run typecheck && npm run test && npm run build
git add -A
git commit -m "feat(compare): 快照主体混合对比——演示名单入口+xray API slug 兼容"
```

### 任务 12：对比页改造（骨架屏/去 K.O./角标/灯语卡/风险分）

**文件：**
- 删除：`components/compare/BattleLoading.tsx`
- 修改：`components/compare/CompareClient.tsx`（LiteArena 全部 + loading 分支）
- 修改：`components/compare/CompareVerdictBar.tsx`（比分中文）

- [ ] **步骤 1：骨架屏替换加载**

`CompareClient.tsx` 加载分支改为内联骨架（删除 BattleLoading 引用与文件）：

```tsx
      {loading && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="glass-card h-72 animate-pulse p-6">
              <div className="h-5 w-1/3 rounded bg-ink-bg/80" />
              <div className="mt-4 h-3 w-2/3 rounded bg-ink-bg/80" />
              <div className="mt-2 h-3 w-1/2 rounded bg-ink-bg/80" />
              <div className="mt-6 h-24 rounded bg-ink-bg/60" />
            </div>
          ))}
          <p className="col-span-2 text-center font-mono text-xs text-slate-500">正在生成两份体检报告…</p>
        </div>
      )}
```

- [ ] **步骤 2：LiteArena 改造**

- VS 徽章：删除 K.O. 分支，`{outcome === 'draw' ? 'VS' : 'VS'}` 简化为恒 'VS'
- `cardWrap` 函数删除；两个 motion.div 的 style 去掉；胜者角标在胜者卡外包一层 relative + 绝对定位 chip：

```tsx
function WinnerBadge({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="absolute -top-3 right-4 z-10 rounded-btn border border-safe/50 bg-ink-card px-2.5 py-1 font-mono text-[11px] text-safe shadow-glow">
      钱付这家更稳
    </span>
  )
}
// 渲染：<div className="relative"><WinnerBadge show={outcome === 'A'} /><CharacterPanel xray={a} /></div>
```

- 双方诊断 → 双方灯语卡（verdictQuoteTitle 已是"两边各一句"）：

```tsx
      <motion.div variants={fade} custom={4} initial="hidden" animate="show" className="mt-6">
        <div className="mb-3 font-mono text-[11px] tracking-[0.25em] text-slate-500">{terms.verdictQuoteTitle}</div>
        <div className="grid gap-4 md:grid-cols-2">
          {[a, b].map((x) => {
            const light = x.light ?? {
              color: x.overallRisk,
              headline: x.overallRisk === 'red' ? '先别付这钱' : x.overallRisk === 'yellow' ? '能付，但换个付法' : '这钱能付',
              reason: x.verdict.split('。')[0] + '。',
            }
            return (
              <blockquote key={x.id} className="glass-card p-5">
                <p className="text-base font-bold" style={{ color: t.riskColor[light.color] }}>{light.headline}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{x.llm?.lightReason ?? light.reason}</p>
                <footer className="mt-3 font-mono text-[11px] text-slate-500">— {x.name}</footer>
              </blockquote>
            )
          })}
        </div>
      </motion.div>
```

- [ ] **步骤 3：CompareVerdictBar 比分中文**

LITE 分支（PRO 不动）：

```tsx
      <span className="font-mono text-xs text-slate-400">
        风险分 {a.riskScore} : {b.riskScore}
      </span>
```

- [ ] **步骤 4：删除 BattleLoading + 全量验证**

```bash
rm components/compare/BattleLoading.tsx
npm run typecheck && npm run test && npm run build
```
预期：全绿。

- [ ] **步骤 5：Commit**

```bash
git add -A
git commit -m "feat(compare): 去 RPG 符号——骨架屏/VS 恒显/胜者角标/双方灯语/风险分中文"
```

---

## P4 验收

### 任务 13：全量验收

**文件：** 无新增（验证任务）

- [ ] **步骤 1：静态检查与测试**

```bash
npm run typecheck && npm run test && npm run build
```
预期：全绿（vitest 全量含三档回归）。

- [ ] **步骤 2：三档 curl 复测**

```bash
curl -s http://localhost:3000/api/company/mock-healthy/xray | python -c "import sys,json; d=json.load(sys.stdin); print(d['overallRisk'], d['light']['headline'])"
# 预期：green 这钱能付
curl -s http://localhost:3000/api/company/mock-warning/xray | python -c "import sys,json; d=json.load(sys.stdin); print(d['overallRisk'], d['light']['headline'], d['light']['saferAdvice'][:10])"
# 预期：yellow 能付，但换个付法 <saferAdvice 前10字>
curl -s http://localhost:3000/api/company/mock-danger/xray | python -c "import sys,json; d=json.load(sys.stdin); print(d['overallRisk'], d['light']['headline'])"
# 预期：red 先别付这钱
```
（dev server 若热重载陈旧，先重启再测——项目 dev 验证五坑。）

- [ ] **步骤 3：双分辨率截图验收**

1920×1080 与 1366×768 下截 /report/mock-warning 与 /compare?a=mock-healthy&b=mock-danger：
- 灯区置顶、headline 大字可见、黄灯显示"怎么付更安全"
- 一屏内容不溢出（1366×768 下右列可内滚）
- debuff 层数刻度可见（mock-warning 质押 45% → 2/3 层）
- 对比页：VS 恒显、胜者"钱付这家更稳"角标、骨架屏文案、双方灯语卡

- [ ] **步骤 4：Commit（如有截图修正）**

```bash
git add -A
git commit -m "chore: LITE 简洁化验收收尾"
```

---

## 自检记录（writing-plans 自检清单）

**1. 规格覆盖度：** 契约增量→任务1；deriveLight→2；tier→3；上市挂灯→4；非上市灯→5；词表→6；灯区→7；版式拆分→8；debuff 三件套→9（叠加警告条在任务 8 步骤 2 XrayClient 内）；文案除漏→10；混合对比→11；对比页改造→12；验收→13。规格"错误处理与降级"节：light 缺席兜底在 LightBanner/LiteArena 代码内；LLM 缺席=模板路径；available=false 沿用原卡；非上市缺切片=任务 8 MissingBlock；黄灯 saferAdvice 缺失=deriveLight 只在黄灯才产出、模板必给。**无遗漏。**

**2. 占位符扫描：** 无待定/TODO；每个代码步骤含完整代码；灯语卡色值走 `useTokens().riskColor`（LiteArena 已有 `const t = useTokens()`），无硬编码色值。

**3. 类型一致性：** `deriveLight` 签名三处调用一致；`tier: { current, max }` 在 types/rules/test/组件一致；`SlotPick`/`SnapshotSubject` 在注册表/选择器/容器一致；`lightReason` 在 types/LightBanner/LiteArena 一致。**通过。**
