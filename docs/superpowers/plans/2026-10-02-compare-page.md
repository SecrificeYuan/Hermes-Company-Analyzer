# /compare 对比页重设计 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 按规格 `docs/superpowers/specs/2026-10-02-compare-page-design.md` 重设计 /compare：LITE 对战台（唯一胜负判定）+ PRO 对比模块流（雷达/指标表/趋势/风险 + LLM 占位卡），URL 参数可分享。

**架构：** `app/compare/page.tsx` 改为 Server Component（`force-dynamic`），解析 `?a=&b=` 后把初始选择传给 `components/compare/CompareClient.tsx`（客户端状态机：idle/loading/result/draw/error）。七个新展示组件放 `components/compare/`，全部纯 props 驱动、双模式走 `useTokens()` + `getTerms(mode)`；胜负判定与 URL 校验是纯函数，TDD 覆盖。

**技术栈：** Next.js 15.3（App Router，async searchParams）· React 19 · Tailwind（CSS 变量双主题）· ECharts 5.6（禁 pieces 型 visualMap + 折线类目轴，见 CashFlowChart 注释）· framer-motion · vitest。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| 创建 `lib/analysis/compare-verdict.ts` | 胜负判定纯函数 |
| 测试 `lib/__tests__/compare-verdict.test.ts` | 判定边界测试 |
| 创建 `lib/compare-params.ts` | URL 参数校验纯函数 |
| 测试 `lib/__tests__/compare-params.test.ts` | 参数校验测试 |
| 修改 `lib/theme/terms.ts` | `Terms` 接口新增 `compare` 分组（LITE/PRO） |
| 修改 `lib/__tests__/terms.test.ts` | compare 术语断言 |
| 创建 `components/compare/DualRadar.tsx` | 双圈对比雷达 + 逐项 diff chip |
| 创建 `components/compare/MetricCompareTable.tsx` | 指标对比表（direction 着色 + 行内 Sparkline） |
| 创建 `components/compare/TrendCompare.tsx` | 现金流 + 舆情双 grid 双线对比 |
| 创建 `components/compare/RiskCompare.tsx` | 风险事件双列对比（复用 EvidenceDrawer） |
| 创建 `components/compare/LlmPlaceholder.tsx` | LLM 占位卡 |
| 创建 `components/compare/CompareVerdictBar.tsx` | 判定横幅（LITE 战报 / PRO 对比条） |
| 创建 `components/compare/CompareSelector.tsx` | 选择器横栏（下拉 + 主按钮 + 复制链接） |
| 创建 `components/compare/CompareClient.tsx` | 客户端状态机 + LITE/PRO 结果区编排 |
| 重写 `app/compare/page.tsx` | Server Component：解析 searchParams |

复用不改动：`EChart`/`ChartEmpty`（components/xray/EChart.tsx）、`baseChartOptionFor`/`baseAxisFor`、`CharacterCard`、`EvidenceDrawer`、`ui/*`、`PRESET_COMPANIES`、`formatWan`（lib/utils.ts）、`scoreColor`。

---

### 任务 1：胜负判定纯函数 compareVerdict

**文件：**
- 创建：`lib/analysis/compare-verdict.ts`
- 测试：`lib/__tests__/compare-verdict.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
// lib/__tests__/compare-verdict.test.ts
import { describe, expect, it } from 'vitest'
import { compareVerdict } from '@/lib/analysis/compare-verdict'

describe('compareVerdict 胜负判定', () => {
  it('A 风险分更低 → A 胜', () => expect(compareVerdict(28, 61)).toBe('A'))
  it('B 风险分更低 → B 胜', () => expect(compareVerdict(70, 40)).toBe('B'))
  it('分差 =3 → 平局（含等号）', () => expect(compareVerdict(10, 13)).toBe('draw'))
  it('分差 <3 → 平局', () => expect(compareVerdict(50, 52)).toBe('draw'))
  it('分差 >3 → 有胜负（边界外）', () => expect(compareVerdict(10, 14)).toBe('A'))
  it('极端分：0 vs 100', () => expect(compareVerdict(0, 100)).toBe('A'))
  it('同分 → 平局', () => expect(compareVerdict(42, 42)).toBe('draw'))
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test -- compare-verdict`
预期：FAIL，`Cannot find module '@/lib/analysis/compare-verdict'`

- [ ] **步骤 3：编写最少实现**

```ts
// lib/analysis/compare-verdict.ts
/**
 * 双公司对比胜负判定：riskScore（0-100，越低越健康）低者胜；
 * 两家分差 ≤3 视为平局（DRAW）。
 */
export type CompareOutcome = 'A' | 'B' | 'draw'

export function compareVerdict(aScore: number, bScore: number): CompareOutcome {
  if (Math.abs(aScore - bScore) <= 3) return 'draw'
  return aScore < bScore ? 'A' : 'B'
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npm run test -- compare-verdict`
预期：PASS（7 个用例全过）

- [ ] **步骤 5：Commit**

```bash
git add lib/analysis/compare-verdict.ts lib/__tests__/compare-verdict.test.ts
git commit -m "feat: 双公司胜负判定纯函数 compareVerdict（分差≤3 平局）"
```

---

### 任务 2：URL 参数校验 parseCompareParams

**文件：**
- 创建：`lib/compare-params.ts`
- 测试：`lib/__tests__/compare-params.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
// lib/__tests__/compare-params.test.ts
import { describe, expect, it } from 'vitest'
import { parseCompareParams } from '@/lib/compare-params'

describe('parseCompareParams URL 参数校验', () => {
  it('两家均为合法预设 → 通过', () =>
    expect(parseCompareParams({ a: 'mock-healthy', b: 'mock-danger' })).toEqual({ a: 'mock-healthy', b: 'mock-danger' }))
  it('相同公司 → null', () =>
    expect(parseCompareParams({ a: 'mock-healthy', b: 'mock-healthy' })).toBeNull())
  it('未知 id → null', () =>
    expect(parseCompareParams({ a: 'mock-healthy', b: 'nope' })).toBeNull())
  it('缺失一个参数 → null', () =>
    expect(parseCompareParams({ a: 'mock-healthy' })).toBeNull())
  it('空对象 / null → null', () => {
    expect(parseCompareParams({})).toBeNull()
    expect(parseCompareParams(null)).toBeNull()
    expect(parseCompareParams(undefined)).toBeNull()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test -- compare-params`
预期：FAIL，`Cannot find module '@/lib/compare-params'`

- [ ] **步骤 3：编写最少实现**

```ts
// lib/compare-params.ts
import { PRESET_COMPANIES } from './presets'

export interface CompareSelection {
  a: string
  b: string
}

/** 校验 URL 对比参数：两家都须为预设公司且互异，否则返回 null（页面回初始态） */
export function parseCompareParams(params: { a?: string; b?: string } | null | undefined): CompareSelection | null {
  const a = params?.a
  const b = params?.b
  if (!a || !b || a === b) return null
  const ids = new Set(PRESET_COMPANIES.map((c) => c.id))
  return ids.has(a) && ids.has(b) ? { a, b } : null
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npm run test -- compare-params`
预期：PASS（5 个用例全过）

- [ ] **步骤 5：Commit**

```bash
git add lib/compare-params.ts lib/__tests__/compare-params.test.ts
git commit -m "feat: /compare URL 参数校验 parseCompareParams"
```

---

### 任务 3：术语字典 compare 分组

**文件：**
- 修改：`lib/theme/terms.ts`（接口 + LITE + PRO 三处）
- 修改：`lib/__tests__/terms.test.ts`（追加两个用例）

- [ ] **步骤 1：追加失败测试**

在 `lib/__tests__/terms.test.ts` 的 `describe('术语字典', ...)` 内、最后一个 `it` 之后追加：

```ts
  it('LITE 对比页术语', () => {
    const c = getTerms('lite').compare
    expect(c.title).toBe('双公司对战')
    expect(c.action).toBe('开战')
    expect(c.actionLoading).toBe('分析中…')
    expect(c.winnerTemplate).toBe('{name} 胜 · 更健康')
    expect(c.drawLabel).toBe('势均力敌')
    expect(c.slotLabel).toBe('PLAYER {slot}')
    expect(c.cardTitles.table).toBe('关键指标对比')
    expect(c.cardTitles.trend).toBe('趋势对决')
    expect(c.cardTitles.risk).toBe('风险状态对决')
  })

  it('PRO 对比页术语', () => {
    const c = getTerms('pro').compare
    expect(c.title).toBe('双公司对比')
    expect(c.action).toBe('开始对比')
    expect(c.actionLoading).toBe('对比分析中…')
    expect(c.winnerTemplate).toBe('{name} 综合占优')
    expect(c.drawLabel).toBe('基本一致')
    expect(c.slotLabel).toBe('公司 {slot}')
    expect(c.cardTitles.trend).toBe('趋势对比')
    expect(c.cardTitles.risk).toBe('风险事件对比')
    expect(c.llmTitle).toBe('AI 深度对比')
  })
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test -- terms`
预期：FAIL，`compare` 属性不存在（TS 报错 / undefined 断言失败）

- [ ] **步骤 3：实现 compare 分组**

`lib/theme/terms.ts` 三处修改：

(a) `Terms` 接口中 `cardTitles` 之后新增：

```ts
export interface CompareTerms {
  title: string
  action: string
  actionLoading: string
  winnerTemplate: string
  drawLabel: string
  idleHint: string
  slotLabel: string
  copyLink: string
  copied: string
  retry: string
  sameCompanyHint: string
  verdictQuoteTitle: string
  cardTitles: { table: string; trend: string; risk: string }
  llmTitle: string
  llmHint: string
}
```

并把 `compare: CompareTerms` 加入 `Terms` 接口。

(b) `const LITE: Terms = { ... }` 中 `cardTitles` 之后新增：

```ts
  compare: {
    title: '双公司对战',
    action: '开战',
    actionLoading: '分析中…',
    winnerTemplate: '{name} 胜 · 更健康',
    drawLabel: '势均力敌',
    idleHint: '选两家公司，看看谁更健康',
    slotLabel: 'PLAYER {slot}',
    copyLink: '复制对比链接',
    copied: '已复制 ✓',
    retry: '重试',
    sameCompanyHint: '请选择两家不同的公司',
    verdictQuoteTitle: '双方诊断',
    cardTitles: { table: '关键指标对比', trend: '趋势对决', risk: '风险状态对决' },
    llmTitle: 'AI 深度对比',
    llmHint: '大模型多维归因 · 即将上线',
  },
```

(c) `const PRO: Terms = { ... }` 中 `cardTitles` 之后新增：

```ts
  compare: {
    title: '双公司对比',
    action: '开始对比',
    actionLoading: '对比分析中…',
    winnerTemplate: '{name} 综合占优',
    drawLabel: '基本一致',
    idleHint: '选择两家公司开始对比',
    slotLabel: '公司 {slot}',
    copyLink: '复制对比链接',
    copied: '已复制 ✓',
    retry: '重试',
    sameCompanyHint: '请选择两家不同的公司',
    verdictQuoteTitle: '诊断引述',
    cardTitles: { table: '关键指标对比', trend: '趋势对比', risk: '风险事件对比' },
    llmTitle: 'AI 深度对比',
    llmHint: '大模型多维归因分析 · 即将上线',
  },
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npm run test -- terms`
预期：PASS（原有用例 + 新增 2 个全过）

- [ ] **步骤 5：Commit**

```bash
git add lib/theme/terms.ts lib/__tests__/terms.test.ts
git commit -m "feat: 术语字典新增 compare 分组（对战/对比双模式文案）"
```

---

### 任务 4：DualRadar 双圈对比雷达

**文件：**
- 创建：`components/compare/DualRadar.tsx`

**说明：** 仓库无组件级测试基建（vitest 仅 `lib/**`），本任务验证 = typecheck + lint；视觉行为列入任务 11 手动验收。

- [ ] **步骤 1：编写组件**

```tsx
// components/compare/DualRadar.tsx
'use client'

import type { EChartsOption } from 'echarts'
import { EChart } from '@/components/xray/EChart'
import { baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

/** 五维口径与单公司版一致；atk 为 lower-better，其余 higher-better（对齐 analyze.ts composite 公式） */
const HIGHER_BETTER = [true, true, false, true, true]

/**
 * 双圈对比雷达：A = accent 实线主圈，B = text-dim 细淡虚线圈（重叠弱化）；
 * 图下方 5 个 diff chip 逐项标差异，▲▼ 按「对 A 有利/不利」着色。
 */
export function DualRadar({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  const t = useTokens()
  const mode = useMode()
  const terms = getTerms(mode)

  const val = (x: CompanyXRay) => [x.hp.score, x.def.score, x.atk.score, x.morale.score, 100 - x.riskScore]
  const va = val(a)
  const vb = val(b)

  const option: EChartsOption = {
    ...baseChartOptionFor(t),
    legend: {
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: t.colors.textDim, fontSize: 11 },
    },
    radar: {
      indicator: terms.radarIndicators.map((name) => ({ name, max: 100 })),
      radius: '62%',
      center: ['50%', '44%'],
      axisName: { color: t.colors.textDim, fontSize: 11 },
      splitLine: { lineStyle: { color: t.colors.gridLine } },
      splitArea: { areaStyle: { color: ['transparent', `${t.colors.accent}08`] } },
      axisLine: { lineStyle: { color: t.colors.gridLine } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: va,
            name: a.name,
            areaStyle: { color: `${t.colors.accent}38` },
            lineStyle: { color: t.colors.accent, width: 2 },
            itemStyle: { color: t.colors.accent },
            symbolSize: 4,
            emphasis: { lineStyle: { width: 3.5 } },
          },
          {
            value: vb,
            name: b.name,
            areaStyle: { color: `${t.colors.textDim}26` },
            lineStyle: { color: t.colors.textDim, width: 1.5, type: 'dashed' },
            itemStyle: { color: t.colors.textDim },
            symbolSize: 3,
            emphasis: { lineStyle: { width: 3 } },
          },
        ],
      },
    ],
  }

  return (
    <div>
      <EChart option={option} height={280} theme={mode} />
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {terms.radarIndicators.map((name, i) => {
          const d = va[i] - vb[i]
          const good = d === 0 ? null : HIGHER_BETTER[i] ? d > 0 : d < 0
          const color = good === null ? t.colors.textFaint : good ? t.colors.safe : t.colors.danger
          return (
            <span
              key={name}
              className="rounded border px-2 py-0.5 font-mono text-[11px]"
              style={{ borderColor: `${color}44`, color }}
            >
              {name} {d === 0 ? '±0' : `${d > 0 ? '▲' : '▼'}${Math.abs(d)}`}
            </span>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：typecheck + lint**

运行：`npm run typecheck && npm run lint`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add components/compare/DualRadar.tsx
git commit -m "feat: DualRadar 双圈对比雷达（重叠弱化 + 逐项 diff chip）"
```

---

### 任务 5：MetricCompareTable 指标对比表

**文件：**
- 创建：`components/compare/MetricCompareTable.tsx`

- [ ] **步骤 1：编写组件**

```tsx
// components/compare/MetricCompareTable.tsx
'use client'

import { formatWan } from '@/lib/utils'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

type Direction = 'higher-better' | 'lower-better'

interface Row {
  key: string
  label: string
  a: number
  b: number
  direction: Direction
  format: (v: number) => string
  spark: { a: (number | null)[]; b: (number | null)[] } | null
}

/** 两家 trend 按较长序列对齐，短边补 null（图上自然断线） */
function alignTrend(aData: number[], bData: number[]) {
  const n = Math.max(aData.length, bData.length)
  return {
    a: Array.from({ length: n }, (_, i) => aData[i] ?? null),
    b: Array.from({ length: n }, (_, i) => bData[i] ?? null),
  }
}

/** 行内迷你趋势线（SVG，避免每行一个 ECharts 实例）；数据点 <2 不画 */
function Spark({ data, color }: { data: (number | null)[]; color: string }) {
  const vals = data.filter((v): v is number => v != null)
  if (vals.length < 2) return null
  const w = 120
  const h = 32
  const min = Math.min(...vals)
  const span = Math.max(...vals) - min || 1
  const pts = vals
    .map((v, i) => `${((i * w) / (vals.length - 1)).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
    .join(' ')
  return <svg width={w} height={h} className="block"><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} /></svg>
}

/**
 * 关键指标对比表：差值列按每行 direction 着色（对 A 有利 → safe / 不利 → danger）。
 * 方向约定对齐 analyze.ts composite 公式（atk、风险分、负债率、质押、被执行 = lower-better）。
 */
export function MetricCompareTable({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  const t = useTokens()
  const mode = useMode()
  const terms = getTerms(mode)

  const pct = (v: number) => `${v}%`
  const id = (v: number) => `${v}`

  const cf = alignTrend(a.hp.trend, b.hp.trend)
  const mo = alignTrend(a.morale.trend, b.morale.trend)

  const rows: Row[] = [
    { key: 'hp', label: terms.healthLabel, a: a.hp.score, b: b.hp.score, direction: 'higher-better', format: id, spark: null },
    { key: 'cashflow', label: '经营现金流', a: a.hp.cashFlow, b: b.hp.cashFlow, direction: 'higher-better', format: formatWan, spark: { a: cf.a, b: cf.b } },
    { key: 'debt', label: '资产负债率', a: a.hp.debtRatio, b: b.hp.debtRatio, direction: 'lower-better', format: pct, spark: null },
    { key: 'def', label: terms.defLabel, a: a.def.score, b: b.def.score, direction: 'higher-better', format: id, spark: null },
    { key: 'pledge', label: '质押比例', a: a.def.pledgeRatio, b: b.def.pledgeRatio, direction: 'lower-better', format: pct, spark: null },
    { key: 'coverage', label: '资产覆盖率', a: a.def.assetCoverage, b: b.def.assetCoverage, direction: 'higher-better', format: pct, spark: null },
    { key: 'atk', label: terms.atkLabel, a: a.atk.score, b: b.atk.score, direction: 'lower-better', format: id, spark: null },
    { key: 'lawsuits', label: '诉讼数量', a: a.atk.lawsuitCount, b: b.atk.lawsuitCount, direction: 'lower-better', format: (v) => `${v} 起`, spark: null },
    { key: 'exec', label: '被执行金额', a: a.atk.executionAmount, b: b.atk.executionAmount, direction: 'lower-better', format: formatWan, spark: null },
    { key: 'morale', label: terms.moraleLabel, a: a.morale.score, b: b.morale.score, direction: 'higher-better', format: id, spark: null },
    { key: 'tone', label: 'avgTone（-10~10）', a: a.morale.avgTone, b: b.morale.avgTone, direction: 'higher-better', format: id, spark: { a: mo.a, b: mo.b } },
    { key: 'risk', label: '综合风险分', a: a.riskScore, b: b.riskScore, direction: 'lower-better', format: id, spark: null },
    { key: 'steady', label: '稳健度（100-风险分）', a: 100 - a.riskScore, b: 100 - b.riskScore, direction: 'higher-better', format: id, spark: null },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-xs">
        <thead>
          <tr style={{ color: t.colors.textFaint }}>
            <th className="py-2 pr-4 text-left font-normal">指标</th>
            <th className="py-2 pr-4 text-right font-normal">{a.name}</th>
            <th className="py-2 pr-4 text-right font-normal">{b.name}</th>
            <th className="py-2 pr-4 text-right font-normal">差值 A−B</th>
            <th className="py-2 text-right font-normal">趋势</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const raw = r.a - r.b
            const good = raw === 0 ? null : r.direction === 'higher-better' ? raw > 0 : raw < 0
            const color = good === null ? t.colors.textDim : good ? t.colors.safe : t.colors.danger
            return (
              <tr key={r.key} className="border-t" style={{ borderColor: t.colors.edge }}>
                <td className="py-2.5 pr-4" style={{ color: t.colors.textDim }}>{r.label}</td>
                <td className="py-2.5 pr-4 text-right" style={{ color: t.colors.textMain }}>{r.format(r.a)}</td>
                <td className="py-2.5 pr-4 text-right" style={{ color: t.colors.textMain }}>{r.format(r.b)}</td>
                <td className="py-2.5 pr-4 text-right" style={{ color }}>
                  {raw === 0 ? '±0' : `${raw > 0 ? '▲' : '▼'} ${r.format(Math.abs(raw))}`}
                </td>
                <td className="py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    {r.spark ? (
                      <>
                        <Spark data={r.spark.a} color={t.colors.accent} />
                        <Spark data={r.spark.b} color={t.colors.textDim} />
                      </>
                    ) : (
                      <span style={{ color: t.colors.textFaint }}>—</span>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **步骤 2：typecheck + lint**

运行：`npm run typecheck && npm run lint`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add components/compare/MetricCompareTable.tsx
git commit -m "feat: MetricCompareTable 指标对比表（direction 差值着色 + 行内 Sparkline）"
```

---

### 任务 6：TrendCompare 趋势双线对比

**文件：**
- 创建：`components/compare/TrendCompare.tsx`

- [ ] **步骤 1：编写组件**

```tsx
// components/compare/TrendCompare.tsx
'use client'

import type { EChartsOption } from 'echarts'
import { ChartEmpty, EChart } from '@/components/xray/EChart'
import { baseAxisFor, baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { formatWan } from '@/lib/utils'
import type { CompanyXRay } from '@/lib/types'

function pad(data: number[], n: number): (number | null)[] {
  return Array.from({ length: n }, (_, i) => data[i] ?? null)
}

/**
 * 趋势双线对比：单 EChart 双 grid——上 = 经营现金流多年（A 实线 / B 虚线），
 * 下 = 舆情指数 12 月（min/max ±10，0 中线）。
 * 不用 visualMap（echarts 5.6 pieces 型 + 折线类目轴有渲染崩溃史，见 CashFlowChart 注释）。
 */
export function TrendCompare({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  const t = useTokens()
  const mode = useMode()

  if (a.hp.trend.length === 0 && b.hp.trend.length === 0 && a.morale.trend.length === 0 && b.morale.trend.length === 0) {
    return <ChartEmpty height={440} text="趋势数据暂缺" />
  }

  const cfN = Math.max(a.hp.trend.length, b.hp.trend.length)
  const cfLabels =
    a.hp.labels?.length === cfN ? a.hp.labels
    : b.hp.labels?.length === cfN ? b.hp.labels
    : Array.from({ length: cfN }, (_, i) => `期${i + 1}`)
  const moN = Math.max(a.morale.trend.length, b.morale.trend.length)
  const moLabels =
    a.morale.labels?.length === moN ? a.morale.labels
    : b.morale.labels?.length === moN ? b.morale.labels
    : Array.from({ length: moN }, (_, i) => `期${i + 1}`)

  const base = baseChartOptionFor(t)
  const axis = baseAxisFor(t)

  const line = (data: (number | null)[], color: string, name: string, dashed: boolean) => ({
    name,
    type: 'line' as const,
    data,
    smooth: true,
    symbolSize: 5,
    lineStyle: { width: 2.5, color, type: (dashed ? 'dashed' : 'solid') as 'dashed' | 'solid' },
    itemStyle: { color },
    emphasis: { focus: 'series' as const },
  })

  const option: EChartsOption = {
    ...base,
    tooltip: { ...base.tooltip, trigger: 'axis' },
    legend: { top: 0, itemWidth: 16, itemHeight: 8, textStyle: { color: t.colors.textDim, fontSize: 11 } },
    grid: [
      { left: 8, right: 16, top: 34, height: '34%', containLabel: true },
      { left: 8, right: 16, top: '60%', bottom: 4, containLabel: true },
    ],
    xAxis: [
      { type: 'category', data: cfLabels, ...axis, gridIndex: 0 },
      { type: 'category', data: moLabels, ...axis, gridIndex: 1, axisLabel: { ...axis.axisLabel, formatter: (v: string) => v.slice(5) } },
    ],
    yAxis: [
      { type: 'value', ...axis, gridIndex: 0, axisLabel: { ...axis.axisLabel, formatter: (v: number) => formatWan(v) } },
      { type: 'value', min: -10, max: 10, ...axis, gridIndex: 1 },
    ],
    series: [
      { ...line(pad(a.hp.trend, cfN), t.colors.accent, a.name, false), xAxisIndex: 0, yAxisIndex: 0 },
      { ...line(pad(b.hp.trend, cfN), t.colors.textDim, b.name, true), xAxisIndex: 0, yAxisIndex: 0 },
      {
        ...line(pad(a.morale.trend, moN), t.colors.accent, a.name, false),
        xAxisIndex: 1,
        yAxisIndex: 1,
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: t.colors.textDim, opacity: 0.5 },
          data: [{ yAxis: 0 }],
          label: { show: false },
        },
      },
      { ...line(pad(b.morale.trend, moN), t.colors.textDim, b.name, true), xAxisIndex: 1, yAxisIndex: 1 },
    ],
  }
  return <EChart option={option} height={440} theme={mode} />
}
```

- [ ] **步骤 2：typecheck + lint**

运行：`npm run typecheck && npm run lint`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add components/compare/TrendCompare.tsx
git commit -m "feat: TrendCompare 现金流+舆情双 grid 双线对比"
```

---

### 任务 7：RiskCompare 风险事件对比

**文件：**
- 创建：`components/compare/RiskCompare.tsx`

**说明：** 证据展开复用 `EvidenceDrawer`（读全局 `useXrayStore`），CompareClient 渲染 EvidenceDrawer 后本组件点击即开抽屉，无需本地状态。

- [ ] **步骤 1：编写组件**

```tsx
// components/compare/RiskCompare.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { useXrayStore } from '@/lib/store'
import { useTokens } from '@/lib/theme/use-tokens'
import type { ThemeTokens } from '@/lib/theme/types'
import type { CompanyXRay, HiddenStatus } from '@/lib/types'

const SEV_VARIANT = { high: 'danger', mid: 'warn', low: 'dim' } as const

function sevColor(t: ThemeTokens, severity: HiddenStatus['severity']) {
  return severity === 'high' ? t.colors.danger : severity === 'mid' ? t.colors.warn : t.colors.safe
}

function StatusColumn({ company, items }: { company: string; items: HiddenStatus[] }) {
  const t = useTokens()
  const setActive = useXrayStore((s) => s.setActiveStatus)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold" style={{ color: t.colors.textMain }}>{company}</span>
        <span className="font-mono text-[11px]" style={{ color: t.colors.textFaint }}>×{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-4 text-center font-mono text-xs"
          style={{ borderColor: t.colors.edge, color: t.colors.textFaint }}
        >
          无记录
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((d) => (
            <button
              key={d.id}
              onClick={() => setActive(d)}
              className="w-full rounded-lg border border-ink-edge bg-ink-card p-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: t.colors.textMain }}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sevColor(t, d.severity) }} />
                  {d.label}
                </span>
                <Badge variant={SEV_VARIANT[d.severity]}>{d.severity.toUpperCase()}</Badge>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed" style={{ color: t.colors.textDim }}>
                {d.description}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** 风险事件对比：两家 hiddenStatus 清单并排，点击行开证据抽屉（EvidenceDrawer） */
export function RiskCompare({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <StatusColumn company={a.name} items={a.hiddenStatus} />
      <StatusColumn company={b.name} items={b.hiddenStatus} />
    </div>
  )
}
```

- [ ] **步骤 2：typecheck + lint**

运行：`npm run typecheck && npm run lint`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add components/compare/RiskCompare.tsx
git commit -m "feat: RiskCompare 风险事件双列对比（复用 EvidenceDrawer）"
```

---

### 任务 8：LlmPlaceholder + CompareVerdictBar

**文件：**
- 创建：`components/compare/LlmPlaceholder.tsx`
- 创建：`components/compare/CompareVerdictBar.tsx`

- [ ] **步骤 1：编写 LlmPlaceholder**

```tsx
// components/compare/LlmPlaceholder.tsx
'use client'

import { Sparkles } from 'lucide-react'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'

/** LLM 深度对比占位卡：本期纯展示，后续版本接入真实分析结果 */
export function LlmPlaceholder() {
  const t = useTokens()
  const terms = getTerms(useMode()).compare
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed px-6 py-10 text-center"
      style={{ borderColor: `${t.colors.accent}66`, background: `${t.colors.accent}0A` }}
    >
      <Sparkles className="h-5 w-5" style={{ color: t.colors.accent }} />
      <div className="text-sm font-semibold" style={{ color: t.colors.textMain }}>{terms.llmTitle}</div>
      <div className="font-mono text-[11px]" style={{ color: t.colors.textDim }}>{terms.llmHint}</div>
    </div>
  )
}
```

- [ ] **步骤 2：编写 CompareVerdictBar**

```tsx
// components/compare/CompareVerdictBar.tsx
'use client'

import { Trophy } from 'lucide-react'
import { compareVerdict } from '@/lib/analysis/compare-verdict'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

/**
 * 判定横幅：LITE = 战报风（奖杯 + 发光描边）；PRO = 克制对比条（无动效无发光）。
 * 平局（分差 ≤3）时 LITE 显「势均力敌 · DRAW」，PRO 显「基本一致」。
 */
export function CompareVerdictBar({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  const t = useTokens()
  const mode = useMode()
  const terms = getTerms(mode).compare
  const outcome = compareVerdict(a.riskScore, b.riskScore)
  const winner = outcome === 'A' ? a : outcome === 'B' ? b : null

  if (mode === 'pro') {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-ink-edge bg-ink-card px-6 py-4"
        role="status"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: t.colors.textFaint }}>
            综合对比
          </span>
          <span className="text-base font-semibold" style={{ color: t.colors.textMain }}>
            {winner ? terms.winnerTemplate.replace('{name}', winner.name) : terms.drawLabel}
          </span>
        </div>
        <span className="font-mono text-sm" style={{ color: t.colors.textDim }}>
          {a.name} {a.riskScore} · {b.riskScore} {b.name}
        </span>
      </div>
    )
  }

  const accent = winner ? t.riskColor.green : t.colors.textDim
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-3 rounded-card border px-6 py-5"
      style={{
        borderColor: `${accent}66`,
        background: `${accent}0D`,
        boxShadow: winner ? `0 0 24px ${accent}33` : undefined,
      }}
      role="status"
    >
      {winner && <Trophy className="h-5 w-5" style={{ color: accent }} />}
      <span className="text-xl font-bold text-slate-50">
        {winner ? terms.winnerTemplate.replace('{name}', winner.name) : `${terms.drawLabel} · DRAW`}
      </span>
      <span className="font-mono text-xs text-slate-400">
        RISK {a.riskScore} : {b.riskScore}
      </span>
    </div>
  )
}
```

- [ ] **步骤 3：typecheck + lint**

运行：`npm run typecheck && npm run lint`
预期：无错误

- [ ] **步骤 4：Commit**

```bash
git add components/compare/LlmPlaceholder.tsx components/compare/CompareVerdictBar.tsx
git commit -m "feat: LLM 占位卡 + 双模式判定横幅"
```

---

### 任务 9：CompareSelector 选择器横栏

**文件：**
- 创建：`components/compare/CompareSelector.tsx`

- [ ] **步骤 1：编写组件**

```tsx
// components/compare/CompareSelector.tsx
'use client'

import { Check, GitCompareArrows, Link2, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PRESET_COMPANIES } from '@/lib/presets'
import { useMode } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'

type Slot = 'A' | 'B'

export function CompareSelector({
  value,
  onChange,
  onRun,
  loading,
  sameCompany,
  canCopy,
  copied,
  onCopy,
}: {
  value: Record<Slot, string>
  onChange: (slot: Slot, id: string) => void
  onRun: () => void
  loading: boolean
  sameCompany: boolean
  canCopy: boolean
  copied: boolean
  onCopy: () => void
}) {
  const mode = useMode()
  const terms = getTerms(mode).compare

  return (
    <div className="glass-card flex flex-wrap items-end justify-center gap-4 p-6">
      {(['A', 'B'] as Slot[]).map((slot) => (
        <label key={slot} className="flex flex-col gap-1.5 font-mono text-xs text-slate-400">
          {terms.slotLabel.replace('{slot}', slot)}
          <select
            value={value[slot]}
            disabled={loading}
            onChange={(e) => onChange(slot, e.target.value)}
            className="rounded-btn border border-neon/30 bg-ink-card px-3 py-2 text-sm text-slate-100 focus:outline-none disabled:opacity-50"
          >
            {PRESET_COMPANIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      ))}
      <Button onClick={onRun} disabled={loading || sameCompany} size="lg">
        {mode === 'pro' ? <GitCompareArrows /> : <Swords />}
        {loading ? terms.actionLoading : terms.action}
      </Button>
      {canCopy && (
        <Button variant="ghost" size="sm" onClick={onCopy}>
          {copied ? <Check /> : <Link2 />}
          {copied ? terms.copied : terms.copyLink}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **步骤 2：typecheck + lint**

运行：`npm run typecheck && npm run lint`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add components/compare/CompareSelector.tsx
git commit -m "feat: CompareSelector 选择器横栏（开战/开始对比 + 复制链接）"
```

---

### 任务 10：CompareClient 状态机 + 结果区编排 + page.tsx

**文件：**
- 创建：`components/compare/CompareClient.tsx`
- 重写：`app/compare/page.tsx`

- [ ] **步骤 1：编写 CompareClient**

```tsx
// components/compare/CompareClient.tsx
'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Quote, RotateCcw, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CharacterCard } from '@/components/xray/CharacterCard'
import { EvidenceDrawer } from '@/components/xray/EvidenceDrawer'
import { CompareSelector } from './CompareSelector'
import { CompareVerdictBar } from './CompareVerdictBar'
import { DualRadar } from './DualRadar'
import { LlmPlaceholder } from './LlmPlaceholder'
import { MetricCompareTable } from './MetricCompareTable'
import { RiskCompare } from './RiskCompare'
import { TrendCompare } from './TrendCompare'
import { compareVerdict } from '@/lib/analysis/compare-verdict'
import type { CompareSelection } from '@/lib/compare-params'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

type Slot = 'A' | 'B'
type Pair = Record<Slot, CompanyXRay>

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.05, duration: 0.4 } }),
}

async function fetchPair(pick: Record<Slot, string>): Promise<Pair> {
  const [a, b] = await Promise.all(
    (['A', 'B'] as Slot[]).map(async (s) => {
      const res = await fetch(`/api/company/${pick[s]}/xray`)
      if (!res.ok) throw new Error(`公司 ${s} 数据获取失败`)
      return (await res.json()) as CompanyXRay
    }),
  )
  return { A: a, B: b }
}

function LoadingSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <Skeleton className="h-20 w-full rounded-card" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  )
}

export function CompareClient({ initialPick }: { initialPick: CompareSelection | null }) {
  const router = useRouter()
  const mode = useMode()
  const terms = getTerms(mode).compare

  const [pick, setPick] = useState<Record<Slot, string>>({
    A: initialPick?.a ?? 'mock-healthy',
    B: initialPick?.b ?? 'mock-danger',
  })
  const [result, setResult] = useState<Pair | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const run = useCallback(async (sel: Record<Slot, string>) => {
    setLoading(true)
    setError(null)
    try {
      setResult(await fetchPair(sel))
    } catch (e) {
      setError(e instanceof Error ? e.message : '对比失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialPick) void run({ A: initialPick.a, B: initialPick.b })
    // 仅挂载时执行一次：URL 带参自动开战
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sameCompany = pick.A === pick.B

  const handleRun = () => {
    router.replace(`/compare?a=${pick.A}&b=${pick.B}`)
    void run(pick)
  }

  const handleCopy = async () => {
    const url = `${window.location.origin}/compare?a=${pick.A}&b=${pick.B}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('复制失败，请手动复制：', url)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/"><ArrowLeft /> 返回</Link>
        </Button>
        <h1 className={mode === 'pro' ? 'text-xl font-semibold text-slate-100' : 'text-glow text-xl font-bold text-slate-100'}>
          {terms.title}
        </h1>
        <div className="w-16" />
      </div>

      <CompareSelector
        value={pick}
        onChange={(slot, id) => setPick((p) => ({ ...p, [slot]: id }))}
        onRun={handleRun}
        loading={loading}
        sameCompany={sameCompany}
        canCopy={!!result}
        copied={copied}
        onCopy={handleCopy}
      />

      {sameCompany && <p className="mt-4 text-center font-mono text-xs text-warn">{terms.sameCompanyHint}</p>}

      {error && (
        <div className="mt-6 flex items-center justify-center gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 font-mono text-xs text-danger">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => void run(pick)}>
            <RotateCcw /> {terms.retry}
          </Button>
        </div>
      )}

      {loading && <LoadingSkeleton />}

      {!loading && !error && result && (mode === 'pro'
        ? <ProFlow a={result.A} b={result.B} />
        : <LiteArena a={result.A} b={result.B} />)}

      {!loading && !error && !result && (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <Swords className="h-8 w-8 text-neon/60" />
          <p className="font-mono text-xs text-slate-500">{terms.idleHint}</p>
        </div>
      )}

      <EvidenceDrawer />
    </main>
  )
}

function LiteArena({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  const t = useTokens()
  const terms = getTerms('lite').compare
  const titles = getTerms('lite').cardTitles
  const outcome = compareVerdict(a.riskScore, b.riskScore)

  const cardWrap = (isWinner: boolean): CSSProperties =>
    outcome === 'draw' ? {} : isWinner
      ? { boxShadow: `0 0 24px ${t.colors.safe}40`, borderRadius: 16 }
      : { opacity: 0.7, filter: 'brightness(0.85)' }

  return (
    <div className="mt-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <CompareVerdictBar a={a} b={b} />
      </motion.div>

      <div className="mt-6 grid items-stretch gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <motion.div initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.1 }} style={cardWrap(outcome === 'A')}>
          <CharacterCard xray={a} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.22 }}
          className="flex items-center justify-center"
        >
          <div className="rounded-full border border-neon/40 bg-ink-card px-5 py-3 text-center font-mono text-sm tracking-[0.3em] text-neon shadow-glow">
            {outcome === 'draw' ? 'VS' : 'K.O.'}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.16 }} style={cardWrap(outcome === 'B')}>
          <CharacterCard xray={b} />
        </motion.div>
      </div>

      <motion.div variants={fade} custom={3} initial="hidden" animate="show" className="mt-6">
        <Card>
          <CardHeader><CardTitle>{titles.radar}</CardTitle></CardHeader>
          <CardContent><DualRadar a={a} b={b} /></CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fade} custom={4} initial="hidden" animate="show" className="mt-6">
        <div className="mb-3 font-mono text-[11px] tracking-[0.25em] text-slate-500">{terms.verdictQuoteTitle}</div>
        <div className="grid gap-4 md:grid-cols-2">
          {[a, b].map((x) => (
            <blockquote key={x.id} className="glass-card p-5">
              <Quote className="mb-2 h-4 w-4 text-grape" />
              <p className="text-sm leading-relaxed text-slate-200">{x.verdict}</p>
              <footer className="mt-3 font-mono text-[11px] text-slate-500">— {x.name}</footer>
            </blockquote>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function ProFlow({ a, b }: { a: CompanyXRay; b: CompanyXRay }) {
  const terms = getTerms('pro').compare
  const titles = getTerms('pro').cardTitles

  return (
    <div className="mt-6">
      <motion.div variants={fade} custom={0} initial="hidden" animate="show">
        <CompareVerdictBar a={a} b={b} />
      </motion.div>
      <motion.div variants={fade} custom={1} initial="hidden" animate="show" className="mt-6">
        <LlmPlaceholder />
      </motion.div>
      <motion.div variants={fade} custom={2} initial="hidden" animate="show" className="mt-6">
        <Card>
          <CardHeader><CardTitle>{titles.radar}</CardTitle></CardHeader>
          <CardContent><DualRadar a={a} b={b} /></CardContent>
        </Card>
      </motion.div>
      <motion.div variants={fade} custom={3} initial="hidden" animate="show" className="mt-6">
        <Card>
          <CardHeader><CardTitle>{terms.cardTitles.table}</CardTitle></CardHeader>
          <CardContent><MetricCompareTable a={a} b={b} /></CardContent>
        </Card>
      </motion.div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <motion.div variants={fade} custom={4} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader><CardTitle>{terms.cardTitles.trend}</CardTitle></CardHeader>
            <CardContent><TrendCompare a={a} b={b} /></CardContent>
          </Card>
        </motion.div>
        <motion.div variants={fade} custom={5} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader><CardTitle>{terms.cardTitles.risk}</CardTitle></CardHeader>
            <CardContent><RiskCompare a={a} b={b} /></CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：重写 page.tsx**

```tsx
// app/compare/page.tsx
import { CompareClient } from '@/components/compare/CompareClient'
import { parseCompareParams } from '@/lib/compare-params'

export const dynamic = 'force-dynamic'

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const initial = parseCompareParams({
    a: typeof sp.a === 'string' ? sp.a : undefined,
    b: typeof sp.b === 'string' ? sp.b : undefined,
  })
  return <CompareClient initialPick={initial} />
}
```

- [ ] **步骤 3：全量校验**

运行：`npm run test && npm run typecheck && npm run lint && npm run build`
预期：全部通过（build 成功，无类型/ lint 错误）

- [ ] **步骤 4：Commit**

```bash
git add components/compare/CompareClient.tsx app/compare/page.tsx
git commit -m "feat: /compare 双模式重设计落地（对战台 / 模块流 + URL 参数）"
```

---

### 任务 11：手动验收

**文件：** 无（开发服务器手动验证）

- [ ] **步骤 1：启动 dev**

运行：`npm run dev`，浏览器打开 `http://localhost:3000/compare`

- [ ] **步骤 2：对照规格 §9 逐项验收**

- [ ] mock 3 家两两组合 × 两模式渲染不破版：切换右上角 LITE/PRO 开关逐页检查
- [ ] URL 直达：访问 `/compare?a=mock-healthy&b=mock-danger` 自动开战；点「复制对比链接」换新标签页打开可还原
- [ ] 非法参数：`/compare?a=nope&b=mock-danger` 与 `/compare?a=mock-healthy&b=mock-healthy` 均回初始态不报错
- [ ] 同公司：两个下拉选同一家 → 按钮禁用 + 提示
- [ ] DRAW 态：LITE 下横幅「势均力敌 · DRAW」、双卡同亮度（当前 mock 分差均 >3，此态靠单测覆盖 + 代码走查确认）
- [ ] 错误态：dev 运行中断 API（或改 fetch 路径）触发错误条 + 重试
- [ ] PRO 检查：无发光/扫描线/霓虹青残留（`grep -rn "shadow-glow\|animate-scanline\|#00E5FF" components/compare app/compare` 无命中）
- [ ] Lighthouse：`npm run build && npm run start` 后 Performance ≥80

---

## 自检记录

**规格覆盖度**（规格 → 任务）：
- §2 决策（判定/LITE/PRO/LLM 位置/选择器/结构）→ 任务 1、2、4–10
- §3 状态机 → CompareClient（idle/loading/result/draw/error/同公司）+ parseCompareParams
- §4 组件拆分 → 任务 4–9（目录与职责一一对应）；复用件零改动
- §5 交互（动效/复制/URL replace/错误重试）→ CompareClient + LiteArena + CompareSelector
- §6 图表技术要点 → 任务 4（DualRadar+diff chip）、5（direction 表+Sparkline）、6（双 grid）、7（EvidenceDrawer）、8（LLM 卡）
- §7 术语 → 任务 3（compare 分组全字段）
- §8 契约与判定 → 任务 1（compareVerdict）、2（parseCompareParams）；CompanyXRay 零改动
- §9 测试与验收 → 任务 1/2 单测 + 任务 11 手动清单
- §10 风险 → direction 表内联（任务 5）、DRAW 边界单测（任务 1）、B 圈中性色（任务 4）

**占位符扫描：** 各任务均含完整可运行代码与精确命令；无「待定/后续补充」。

**类型一致性：** `CompareOutcome`/`compareVerdict`（任务 1、8、10 引用一致）；`CompareSelection`/`parseCompareParams`（任务 2、10 一致）；`Terms.compare`/`CompareTerms`（任务 3 定义，4、8、9、10 消费）；`Slot`/`Pair`/`fade` 定义于 CompareClient 内部，不跨文件。diff chip 与差值列的 ▲▼ 格式（有无空格）为两处独立实现，语义一致，不强求字面相等。
