# 双主题设计语言（LITE/PRO）第一期 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 全站双主题化——现有霓虹主题转正为 LITE，新增金融终端 PRO 主题；模式开关切换术语与信息呈现，报告页关键组件完成 PRO 重绘。

**架构：** Tailwind 颜色改为 CSS 变量驱动（`data-theme="lite|pro"`）；主题 token 拆为 `lib/theme/themes/{lite,pro}.ts`；ECharts 基底变为 `baseChartOptionFor(tokens)` 函数；模式由 zustand store（localStorage 持久化）驱动；术语字典按模式取词。不改 `CompanyXRay` 契约。

**技术栈：** Next.js 15 · React 19 · Tailwind 3.4 · zustand 5 · ECharts 5.6 · vitest（新增）

**规格：** `docs/superpowers/specs/2026-10-02-design-language-design.md`

---

### 任务 1：vitest 测试基建

**文件：**
- 创建：`vitest.config.ts`
- 修改：`package.json`
- 创建：`lib/__tests__/smoke.test.ts`

- [ ] **步骤 1：安装依赖**

```bash
npm i -D vitest @vitejs/plugin-react jsdom
```

- [ ] **步骤 2：编写 vitest 配置**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: { environment: 'jsdom', include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'] },
})
```

- [ ] **步骤 3：编写冒烟测试**

```ts
// lib/__tests__/smoke.test.ts
import { describe, expect, it } from 'vitest'

describe('vitest 基建', () => {
  it('正常运行', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **步骤 4：加 script 并验证通过**

在 `package.json` 的 `"scripts"` 中加 `"test": "vitest run"`。

```bash
npm test
```

预期：`1 passed`

- [ ] **步骤 5：Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/__tests__/smoke.test.ts
git commit -m "chore: 引入 vitest 测试基建"
```

---

### 任务 2：模式 store（zustand + localStorage 持久化）

**文件：**
- 创建：`lib/mode-store.ts`
- 测试：`lib/__tests__/mode-store.test.ts`

- [ ] **步骤 1：编写失败测试**

```ts
// lib/__tests__/mode-store.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useModeStore } from '@/lib/mode-store'

describe('mode store', () => {
  beforeEach(() => {
    localStorage.clear()
    useModeStore.setState({ mode: 'lite' })
  })

  it('默认 lite', () => {
    expect(useModeStore.getState().mode).toBe('lite')
  })

  it('setMode 切换到 pro', () => {
    useModeStore.getState().setMode('pro')
    expect(useModeStore.getState().mode).toBe('pro')
    expect(localStorage.getItem('hermes-mode')).toContain('"pro"')
  })

  it('toggleMode 往返', () => {
    useModeStore.getState().toggleMode()
    expect(useModeStore.getState().mode).toBe('pro')
    useModeStore.getState().toggleMode()
    expect(useModeStore.getState().mode).toBe('lite')
  })
})
```

- [ ] **步骤 2：运行验证失败**

```bash
npm test -- mode-store
```

预期：FAIL，`Cannot find module '@/lib/mode-store'`

- [ ] **步骤 3：实现 store**

```ts
// lib/mode-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Mode = 'lite' | 'pro'

interface ModeState {
  mode: Mode
  setMode: (m: Mode) => void
  toggleMode: () => void
}

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      mode: 'lite',
      setMode: (m) => set({ mode: m }),
      toggleMode: () => set((s) => ({ mode: s.mode === 'lite' ? 'pro' : 'lite' })),
    }),
    { name: 'hermes-mode' },
  ),
)
```

- [ ] **步骤 4：运行验证通过**

```bash
npm test -- mode-store
```

预期：`3 passed`

- [ ] **步骤 5：Commit**

```bash
git add lib/mode-store.ts lib/__tests__/mode-store.test.ts
git commit -m "feat: 模式 store（LITE/PRO 切换 + localStorage 持久化）"
```

---

### 任务 3：主题 tokens 拆分（lite/pro/index）

**文件：**
- 创建：`lib/theme/types.ts`、`lib/theme/themes/lite.ts`、`lib/theme/themes/pro.ts`、`lib/theme/index.ts`
- 修改：`lib/theme/tokens.ts`（改为 re-export 兼容层，最后一步删除）
- 测试：`lib/__tests__/theme-tokens.test.ts`

- [ ] **步骤 1：编写失败测试**

```ts
// lib/__tests__/theme-tokens.test.ts
import { describe, expect, it } from 'vitest'
import { getTokens, scoreColor } from '@/lib/theme'
import { liteTokens } from '@/lib/theme/themes/lite'
import { proTokens } from '@/lib/theme/themes/pro'

describe('主题 tokens', () => {
  it('lite 保留原霓虹值', () => {
    expect(liteTokens.colors.accent).toBe('#00E5FF')
    expect(liteTokens.colors.bg).toBe('#070B14')
    expect(liteTokens.riskColor.red).toBe('#FF3B5C')
  })

  it('pro 金融终端值', () => {
    expect(proTokens.colors.accent).toBe('#4C8DFF')
    expect(proTokens.colors.bg).toBe('#0B0F1A')
    expect(proTokens.colors.card).toBe('#101625')
    expect(proTokens.colors.edge).toBe('#1E2A42')
    expect(proTokens.colors.danger).toBe('#FF5C6C')
    expect(proTokens.colors.safe).toBe('#3ECF8E')
    expect(proTokens.riskColor.green).toBe('#3ECF8E')
  })

  it('getTokens 按模式返回', () => {
    expect(getTokens('lite').mode).toBe('lite')
    expect(getTokens('pro').mode).toBe('pro')
  })

  it('scoreColor 阈值两主题一致：<30 红, <60 黄, ≥60 绿', () => {
    for (const t of [liteTokens, proTokens]) {
      expect(scoreColor(t, 20)).toBe(t.riskColor.red)
      expect(scoreColor(t, 45)).toBe(t.riskColor.yellow)
      expect(scoreColor(t, 80)).toBe(t.riskColor.green)
    }
  })
})
```

- [ ] **步骤 2：运行验证失败**

```bash
npm test -- theme-tokens
```

预期：FAIL，模块不存在

- [ ] **步骤 3：实现类型与两主题**

```ts
// lib/theme/types.ts
import type { Mode } from '@/lib/mode-store'

export type RiskLevelKey = 'green' | 'yellow' | 'red'

export interface ThemeColors {
  bg: string
  card: string
  edge: string
  accent: string
  danger: string
  warn: string
  safe: string
  grape: string
  textMain: string
  textDim: string
  textFaint: string
  gridLine: string
}

export interface ThemeTokens {
  mode: Mode
  colors: ThemeColors
  riskColor: Record<RiskLevelKey, string>
}
```

```ts
// lib/theme/themes/lite.ts
import type { ThemeTokens } from '../types'

export const liteTokens: ThemeTokens = {
  mode: 'lite',
  colors: {
    bg: '#070B14',
    card: '#121A2B',
    edge: 'rgba(0,229,255,0.12)',
    accent: '#00E5FF',
    danger: '#FF3B5C',
    warn: '#FFB020',
    safe: '#00E58A',
    grape: '#8B5CF6',
    textMain: '#E2E8F0',
    textDim: '#7C8DB0',
    textFaint: '#7C8DB0',
    gridLine: 'rgba(124,141,176,0.14)',
  },
  riskColor: { green: '#00E58A', yellow: '#FFB020', red: '#FF3B5C' },
}
```

```ts
// lib/theme/themes/pro.ts
import type { ThemeTokens } from '../types'

export const proTokens: ThemeTokens = {
  mode: 'pro',
  colors: {
    bg: '#0B0F1A',
    card: '#101625',
    edge: '#1E2A42',
    accent: '#4C8DFF',
    danger: '#FF5C6C',
    warn: '#FFB020',
    safe: '#3ECF8E',
    grape: '#8B5CF6',
    textMain: '#F4F6FA',
    textDim: '#8B94AB',
    textFaint: '#66738E',
    gridLine: 'rgba(139,148,171,0.14)',
  },
  riskColor: { green: '#3ECF8E', yellow: '#FFB020', red: '#FF5C6C' },
}
```

```ts
// lib/theme/index.ts
import type { Mode } from '@/lib/mode-store'
import { liteTokens } from './themes/lite'
import { proTokens } from './themes/pro'
import type { ThemeTokens } from './types'

export function getTokens(mode: Mode): ThemeTokens {
  return mode === 'pro' ? proTokens : liteTokens
}

/** 分数 → 颜色（越低越危险），阈值与旧实现一致 */
export function scoreColor(t: ThemeTokens, score: number): string {
  if (score >= 60) return t.riskColor.green
  if (score >= 30) return t.riskColor.yellow
  return t.riskColor.red
}

export type { ThemeTokens, ThemeColors, RiskLevelKey } from './types'
export { liteTokens, proTokens }
```

- [ ] **步骤 4：兼容层 + 运行测试**

把 `lib/theme/tokens.ts` 整体替换为：

```ts
// lib/theme/tokens.ts
// 兼容层：旧 import 路径暂保留，任务 7-10 迁移完成后删除本文件。
export { liteTokens as colors, liteTokens } from './themes/lite'
export const riskColor = liteTokens.riskColor
export { scoreColor } from './index'
```

```bash
npm test -- theme-tokens
```

预期：`4 passed`

- [ ] **步骤 5：typecheck 验证兼容层 + Commit**

```bash
npm run typecheck
```

预期：无错误

```bash
git add lib/theme/types.ts lib/theme/themes/ lib/theme/index.ts lib/theme/tokens.ts lib/__tests__/theme-tokens.test.ts
git commit -m "feat: 主题 tokens 拆分为 lite/pro 双主题"
```

---

### 任务 4：CSS 变量 + Tailwind 变量化 + globals.css

**文件：**
- 修改：`app/globals.css`
- 修改：`tailwind.config.ts`

- [ ] **步骤 1：globals.css 定义双主题变量**

在 `app/globals.css` 中，把 `:root { color-scheme: dark; }` 整段替换为：

```css
:root,
[data-theme='lite'] {
  color-scheme: dark;
  --bg: #070b14;
  --card: rgba(18, 26, 43, 0.72);
  --card-solid: #121a2b;
  --edge: rgba(0, 229, 255, 0.12);
  --accent: #00e5ff;
  --danger: #ff3b5c;
  --warn: #ffb020;
  --safe: #00e58a;
  --grape: #8b5cf6;
  --text-main: #e2e8f0;
  --text-dim: #7c8db0;
  --grid-line: rgba(124, 141, 176, 0.14);
  --grid-glow: rgba(0, 229, 255, 0.1);
  --grid-cell: rgba(0, 229, 255, 0.045);
}

[data-theme='pro'] {
  --bg: #0b0f1a;
  --card: #101625;
  --card-solid: #101625;
  --edge: #1e2a42;
  --accent: #4c8dff;
  --danger: #ff5c6c;
  --warn: #ffb020;
  --safe: #3ecf8e;
  --grape: #8b5cf6;
  --text-main: #f4f6fa;
  --text-dim: #8b94ab;
  --grid-line: rgba(139, 148, 171, 0.14);
  --grid-glow: transparent;
  --grid-cell: rgba(139, 148, 171, 0.05);
}

body {
  @apply font-sans antialiased;
  background-color: var(--bg);
  color: var(--text-main);
}
```

- [ ] **步骤 2：glass-card / bg-grid 改变量驱动**

把 `.bg-grid`、`.glass-card`、`.glass-card-hover` 三段替换为：

```css
/* ===== 网格背景（LITE 科幻 / PRO 收敛） ===== */
.bg-grid {
  background-image:
    radial-gradient(ellipse 90% 55% at 50% -10%, var(--grid-glow), transparent),
    linear-gradient(var(--grid-cell) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-cell) 1px, transparent 1px);
  background-size:
    100% 100%,
    48px 48px,
    48px 48px;
}

/* ===== 卡片：LITE 玻璃拟态 / PRO 实底描边 ===== */
.glass-card {
  @apply rounded-card border;
  background: var(--card);
  border-color: var(--edge);
}

[data-theme='lite'] .glass-card {
  @apply backdrop-blur-xl;
}

.glass-card-hover {
  transition: border-color 0.25s ease;
}

.glass-card-hover:hover {
  border-color: var(--accent);
}

/* 移除位移与发光（PRO 禁用；LITE 也不再上浮，保持克制） */
```

`.text-glow` / `.text-glow-danger` / `.scan-beam` 保留不动（仅 LITE 组件使用，任务 9 起 PRO 路径不再引用）。

- [ ] **步骤 3：Tailwind 颜色变量化**

把 `tailwind.config.ts` 的 `colors` 整段替换为：

```ts
      colors: {
        ink: {
          bg: 'var(--bg)',
          card: 'var(--card-solid)',
          edge: 'var(--edge)',
        },
        neon: 'var(--accent)',
        danger: 'var(--danger)',
        warn: 'var(--warn)',
        safe: 'var(--safe)',
        grape: 'var(--grape)',
      },
```

其余（fontFamily/borderRadius/boxShadow/keyframes）不动。

- [ ] **步骤 4：验证构建**

```bash
npm run typecheck && npm run build
```

预期：成功（此时 `data-theme` 未设置，回退到 `:root` 即 lite 值，视觉不变）

- [ ] **步骤 5：Commit**

```bash
git add app/globals.css tailwind.config.ts
git commit -m "feat: CSS 变量驱动的双主题基底（lite/pro）"
```

---

### 任务 5：ThemeSync + ModeToggle + 全站接入

**文件：**
- 创建：`components/theme/ThemeSync.tsx`
- 创建：`components/theme/ModeToggle.tsx`
- 修改：`app/layout.tsx`

- [ ] **步骤 1：ThemeSync（data-theme 同步）**

```tsx
// components/theme/ThemeSync.tsx
'use client'

import { useEffect } from 'react'
import { useModeStore } from '@/lib/mode-store'

/** 把 store 中的模式写入 <html data-theme>，驱动全站 CSS 变量 */
export function ThemeSync() {
  const mode = useModeStore((s) => s.mode)
  useEffect(() => {
    document.documentElement.dataset.theme = mode
  }, [mode])
  return null
}
```

- [ ] **步骤 2：ModeToggle 开关**

```tsx
// components/theme/ModeToggle.tsx
'use client'

import { useModeStore } from '@/lib/mode-store'
import { cn } from '@/lib/utils'

/** 全站 LITE/PRO 模式开关（右上角） */
export function ModeToggle() {
  const mode = useModeStore((s) => s.mode)
  const setMode = useModeStore((s) => s.setMode)
  return (
    <div className="flex items-center rounded-btn border border-ink-edge p-0.5 font-mono text-[11px]">
      {(['lite', 'pro'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={cn(
            'rounded-[6px] px-3 py-1 tracking-wider transition-colors',
            mode === m ? 'bg-neon font-semibold text-ink-bg' : 'text-slate-400 hover:text-slate-200',
          )}
        >
          {m.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **步骤 3：接入 layout**

`app/layout.tsx` 改为：

```tsx
import type { Metadata, Viewport } from 'next'
import { ThemeSync } from '@/components/theme/ThemeSync'
import { ModeToggle } from '@/components/theme/ModeToggle'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hermes · 公司 X 光机',
  description: '输入公司名，30 秒生成一张公司 X 光片：健康度/风险事件/股权网络/风险时间轴。',
}

export const viewport: Viewport = {
  themeColor: '#070B14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-grid min-h-screen">
        <ThemeSync />
        <div className="fixed right-4 top-4 z-50">
          <ModeToggle />
        </div>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **步骤 4：验证**

```bash
npm run typecheck && npm run build
```

预期：成功。手动 `npm run dev` 打开首页，点击 PRO/LITE，背景与卡片颜色应即时切换（此时图表与部分组件仍是旧色，属正常，后续任务处理）。

- [ ] **步骤 5：Commit**

```bash
git add components/theme/ app/layout.tsx
git commit -m "feat: 全站 LITE/PRO 模式开关与主题同步"
```

---

### 任务 6：ECharts 双主题基底 + EChart theme prop

**文件：**
- 创建：`lib/theme/echarts-themes.ts`
- 修改：`components/xray/EChart.tsx`
- 删除：`lib/theme/echarts-dark.ts`（迁移完成后）

- [ ] **步骤 1：编写 echarts-themes.ts**

```ts
// lib/theme/echarts-themes.ts
import type { EChartsOption } from 'echarts'
import type { ThemeTokens } from './types'

/**
 * ECharts 主题基底：按 tokens 生成，替代原 echarts-dark.ts 的静态常量。
 * 用法：const t = useTokens(); { ...baseChartOptionFor(t), ... }
 */
export function baseChartOptionFor(t: ThemeTokens): EChartsOption {
  return {
    backgroundColor: 'transparent',
    textStyle: { color: t.colors.textDim, fontFamily: 'Inter, system-ui, sans-serif' },
    tooltip: {
      backgroundColor: t.mode === 'pro' ? 'rgba(16,22,37,0.95)' : 'rgba(7,11,20,0.92)',
      borderColor: t.colors.edge,
      textStyle: { color: t.colors.textMain, fontSize: 12 },
      confine: true,
    },
    animationDuration: 600,
    animationEasing: 'cubicOut',
  }
}

export function baseAxisFor(t: ThemeTokens) {
  return {
    axisLine: { lineStyle: { color: t.colors.gridLine } },
    axisTick: { show: false },
    axisLabel: { color: t.colors.textDim, fontSize: 11, fontFamily: '"JetBrains Mono", monospace' },
    splitLine: { lineStyle: { color: t.colors.gridLine, type: 'dashed' as const } },
  }
}
```

- [ ] **步骤 2：EChart 增加 theme prop（主题切换时重建实例）**

`components/xray/EChart.tsx` 的 props 与 init effect 改为：

```tsx
'use client'

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { cn } from '@/lib/utils'
import type { Mode } from '@/lib/mode-store'

/**
 * ECharts 轻量封装（替代 echarts-for-react，规避其 React 19 peer 冲突）：
 * 自动 init / setOption / resize / dispose。theme 变化时重建实例以应用新主题基底。
 */
export function EChart({
  option,
  height = 260,
  className,
  theme,
}: {
  option: echarts.EChartsOption
  height?: number
  className?: string
  theme?: Mode
}) {
  const domRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!domRef.current) return
    const chart = echarts.init(domRef.current)
    chartRef.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(domRef.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [theme])

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true })
  }, [option, theme])

  return <div ref={domRef} style={{ height }} className={cn('w-full', className)} />
}
```

（`ChartEmpty` 不变。）

- [ ] **步骤 3：typecheck**

```bash
npm run typecheck
```

预期：成功（旧 `echarts-dark.ts` 仍在但已无新增引用；任务 7 迁移后删除）

- [ ] **步骤 4：Commit**

```bash
git add lib/theme/echarts-themes.ts components/xray/EChart.tsx
git commit -m "feat: ECharts 双主题基底与 EChart theme prop"
```

---

### 任务 7：迁移 5 个图表组件到 useTokens

**文件：**
- 创建：`lib/theme/use-tokens.ts`
- 修改：`components/xray/AttributeRadar.tsx`、`CashFlowChart.tsx`、`LawsuitHeatmap.tsx`、`RelationGraph.tsx`、`SentimentCurve.tsx`

- [ ] **步骤 1：use-tokens hook**

```ts
// lib/theme/use-tokens.ts
'use client'

import { useModeStore } from '@/lib/mode-store'
import { getTokens } from './index'
import type { ThemeTokens } from './types'

export function useMode() {
  return useModeStore((s) => s.mode)
}

export function useTokens(): ThemeTokens {
  return getTokens(useModeStore((s) => s.mode))
}
```

- [ ] **步骤 2：迁移 AttributeRadar.tsx**

整文件替换：

```tsx
'use client'

import type { EChartsOption } from 'echarts'
import { EChart } from './EChart'
import { baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

/** 五维雷达：HP / DEF / ATK(涉诉) / 士气 / 稳健，主色=主题 accent 半透明填充 */
export function AttributeRadar({ xray }: { xray: CompanyXRay }) {
  const t = useTokens()
  const mode = useMode()
  const terms = getTerms(mode)

  const option: EChartsOption = {
    ...baseChartOptionFor(t),
    radar: {
      indicator: terms.radarIndicators.map((name) => ({ name, max: 100 })),
      radius: '68%',
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
            value: [xray.hp.score, xray.def.score, xray.atk.score, xray.morale.score, 100 - xray.riskScore],
            name: terms.radarSeriesName,
            areaStyle: { color: `${t.colors.accent}38` },
            lineStyle: { color: t.colors.accent, width: 2 },
            itemStyle: { color: t.colors.accent },
            symbolSize: 5,
          },
        ],
      },
    ],
  }
  return <EChart option={option} height={250} theme={mode} />
}
```

- [ ] **步骤 3：先建 terms 字典最小实现（任务 8 扩测试）**

```ts
// lib/theme/terms.ts
import type { Mode } from '@/lib/mode-store'

export interface Terms {
  radarIndicators: [string, string, string, string, string]
  radarSeriesName: string
}

const LITE: Terms = {
  radarIndicators: ['HP 血量', 'DEF 护甲', 'ATK 涉诉', '士气', '稳健'],
  radarSeriesName: '五维属性',
}

const PRO: Terms = {
  radarIndicators: ['健康度', '偿债安全', '涉诉风险', '舆情', '稳健'],
  radarSeriesName: '五维指标',
}

export function getTerms(mode: Mode): Terms {
  return mode === 'pro' ? PRO : LITE
}
```

- [ ] **步骤 4：迁移 CashFlowChart.tsx**

把 import 行 `import { baseAxis, baseChartOption, colors } from '@/lib/theme/echarts-dark'` 删除，函数体改为 hook 版本：

```tsx
'use client'

import type { EChartsOption } from 'echarts'
import { ChartEmpty, EChart } from './EChart'
import { baseAxisFor, baseChartOptionFor } from '@/lib/theme/echarts-themes'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { formatWan } from '@/lib/utils'
import type { CompanyXRay } from '@/lib/types'

/** 现金流趋势：渐变面积折线，负值段自动变红 */
export function CashFlowChart({ hp }: { hp: CompanyXRay['hp'] }) {
  const t = useTokens()
  const mode = useMode()

  if (hp.trend.length === 0) return <ChartEmpty height={250} text="财务数据暂缺" />

  const labels = hp.labels ?? hp.trend.map((_, i) => `期${i + 1}`)
  const extent = Math.max(1, ...hp.trend.map((v) => Math.abs(v)))
  const base = baseChartOptionFor(t)
  const axis = baseAxisFor(t)
  const option: EChartsOption = {
    ...base,
    tooltip: {
      ...base.tooltip,
      trigger: 'axis',
      valueFormatter: (v) => formatWan(Number(v)),
    },
    grid: { left: 8, right: 16, top: 24, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: labels, ...axis, boundaryGap: false },
    yAxis: { type: 'value', ...axis, axisLabel: { ...axis.axisLabel, formatter: (v: number) => formatWan(v) } },
    series: [
      {
        type: 'line',
        data: hp.trend,
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 2.5, color: t.colors.accent },
        itemStyle: { color: t.colors.accent },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${t.colors.accent}59` },
              { offset: 1, color: `${t.colors.accent}00` },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: t.colors.danger, type: 'dashed', opacity: 0.6 },
          data: [{ yAxis: 0 }],
          label: { show: false },
        },
      },
    ],
    // 负值段变红（continuous：echarts 5.6 中 pieces 型 visualMap + 折线类目轴会触发渲染崩溃）
    visualMap: {
      show: false,
      min: -extent,
      max: extent,
      inRange: { color: [t.colors.danger, t.colors.accent] },
      seriesIndex: 0,
    },
  }
  return <EChart option={option} height={250} theme={mode} />
}
```

- [ ] **步骤 5：迁移 LawsuitHeatmap.tsx**

import 换成 `baseAxisFor, baseChartOptionFor` 与 `useMode, useTokens`；函数体顶部加 `const t = useTokens(); const mode = useMode()`；`baseChartOption`→`baseChartOptionFor(t)`、`baseAxis`→`baseAxisFor(t)`、`colors.X`→`t.colors.X`；`'rgba(255,176,32,0.15)'`→`` `${t.colors.warn}26` ``；`shadowColor: 'rgba(255,59,92,0.5)'`→`` `${t.colors.danger}80` ``；`borderColor: colors.bg`→`t.colors.bg`；末尾 `<EChart ... height={220} theme={mode} />`。

- [ ] **步骤 6：迁移 RelationGraph.tsx**

import 同上；顶部 `const t = useTokens(); const mode = useMode()`；`NODE_COLOR` 移入组件内（依赖 t）：

```tsx
  const NODE_COLOR: Record<GraphNode['type'], string> = {
    company: t.colors.accent,
    person: t.colors.grape,
    court: t.colors.danger,
    supplier: t.colors.warn,
    media: t.colors.textDim,
  }
```

其余 `colors.X`→`t.colors.X`；`'rgba(0,229,255,0.35)'`→`` `${t.colors.accent}59` ``；`'rgba(255,255,255,0.25)'`→`t.colors.edge`；末尾 `theme={mode}`。

- [ ] **步骤 7：迁移 SentimentCurve.tsx**

import 同上；顶部 hooks；`base`/`axis` 局部变量同 CashFlowChart；`colors.textDim`→`t.colors.textDim`；`inRange: { color: [t.colors.danger, t.colors.safe] }`；末尾 `theme={mode}`。

- [ ] **步骤 8：删除 echarts-dark.ts 并全量验证**

```bash
rm lib/theme/echarts-dark.ts lib/theme/tokens.ts
npm run typecheck
```

预期：无错误（tokens.ts 兼容层已无引用者；若有遗漏 import，补到 `@/lib/theme` 新 API 后重跑）

```bash
npm run build
```

预期：成功

- [ ] **步骤 9：Commit**

```bash
git add lib/theme/ components/xray/
git commit -m "feat: 图表组件迁移至双主题 tokens（useTokens + theme prop）"
```

---

### 任务 8：术语字典补全 + 测试

**文件：**
- 修改：`lib/theme/terms.ts`
- 测试：`lib/__tests__/terms.test.ts`

- [ ] **步骤 1：编写失败测试**

```ts
// lib/__tests__/terms.test.ts
import { describe, expect, it } from 'vitest'
import { getTerms } from '@/lib/theme/terms'

describe('术语字典', () => {
  it('LITE 游戏化术语', () => {
    const lite = getTerms('lite')
    expect(lite.healthLabel).toBe('HP · 财务血量')
    expect(lite.hiddenTitle).toBe('HIDDEN STATUS')
    expect(lite.riskScoreCaption).toBe('RISK SCORE')
  })

  it('PRO 金融术语', () => {
    const pro = getTerms('pro')
    expect(pro.healthLabel).toBe('基本面健康度')
    expect(pro.defLabel).toBe('偿债安全垫')
    expect(pro.atkLabel).toBe('涉诉风险')
    expect(pro.moraleLabel).toBe('舆情指数')
    expect(pro.hiddenTitle).toBe('风险事件')
    expect(pro.riskScoreCaption).toBe('HEALTH SCORE')
    expect(pro.radarSeriesName).toBe('五维指标')
  })
})
```

- [ ] **步骤 2：运行验证失败**

```bash
npm test -- terms
```

预期：FAIL，属性不存在

- [ ] **步骤 3：补全 terms.ts**

```ts
// lib/theme/terms.ts
import type { Mode } from '@/lib/mode-store'

export interface Terms {
  healthLabel: string
  defLabel: string
  atkLabel: string
  moraleLabel: string
  hiddenTitle: string
  riskScoreCaption: string
  radarIndicators: [string, string, string, string, string]
  radarSeriesName: string
}

const LITE: Terms = {
  healthLabel: 'HP · 财务血量',
  defLabel: 'DEF · 护甲',
  atkLabel: 'ATK · 涉诉攻击',
  moraleLabel: '士气 · 舆情',
  hiddenTitle: 'HIDDEN STATUS',
  riskScoreCaption: 'RISK SCORE',
  radarIndicators: ['HP 血量', 'DEF 护甲', 'ATK 涉诉', '士气', '稳健'],
  radarSeriesName: '五维属性',
}

const PRO: Terms = {
  healthLabel: '基本面健康度',
  defLabel: '偿债安全垫',
  atkLabel: '涉诉风险',
  moraleLabel: '舆情指数',
  hiddenTitle: '风险事件',
  riskScoreCaption: 'HEALTH SCORE',
  radarIndicators: ['健康度', '偿债安全', '涉诉风险', '舆情', '稳健'],
  radarSeriesName: '五维指标',
}

export function getTerms(mode: Mode): Terms {
  return mode === 'pro' ? PRO : LITE
}
```

- [ ] **步骤 4：运行验证通过 + typecheck + Commit**

```bash
npm test && npm run typecheck
```

预期：全部通过

```bash
git add lib/theme/terms.ts lib/__tests__/terms.test.ts
git commit -m "feat: LITE/PRO 术语字典"
```

---

### 任务 9：VerdictBanner 双模式

**文件：**
- 修改：`components/xray/VerdictBanner.tsx`

- [ ] **步骤 1：双模式改造**

整文件替换：

```tsx
'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataSourceBadge } from './DataSourceBadge'
import { StatNumber } from './StatNumber'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

const RISK_META = {
  green: { label: '低风险 · GREEN', Icon: ShieldCheck, badge: 'safe' as const },
  yellow: { label: '中风险 · YELLOW', Icon: AlertTriangle, badge: 'warn' as const },
  red: { label: '高风险 · RED', Icon: ShieldAlert, badge: 'danger' as const },
}

/** 评级结论条：LITE 带霓虹扫描线；PRO 克制终端风（扫描线禁用） */
export function VerdictBanner({ xray }: { xray: CompanyXRay }) {
  const meta = RISK_META[xray.overallRisk]
  const t = useTokens()
  const mode = useMode()
  const terms = getTerms(mode)
  const color = t.riskColor[xray.overallRisk]

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card relative overflow-hidden p-6"
      style={{ borderColor: `${color}66` }}
    >
      {/* 扫描线仅 LITE；PRO 顶部改为语义色细线 */}
      {mode === 'lite' ? (
        <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
          <div className="animate-scanline h-full w-1/3 bg-gradient-to-r from-transparent via-neon to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: color }} />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-50">{xray.name}</h1>
            <span className="font-mono text-xs text-slate-500">
              {xray.stockCode} · {xray.industry}
            </span>
          </div>
          <p className="max-w-3xl text-base leading-relaxed text-slate-200">{xray.verdict}</p>
          <p className="mt-2 text-sm text-slate-400">
            <span className="font-mono text-[11px] tracking-wider text-neon/80">ADVICE </span>
            {xray.advice}
          </p>
          <div className="mt-4">
            <DataSourceBadge sources={xray.sources} />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Badge variant={meta.badge} className="gap-1.5 px-3 py-1 text-xs">
            <meta.Icon className="h-3.5 w-3.5" />
            {meta.label}
          </Badge>
          <div className="text-right">
            <StatNumber value={xray.riskScore} className="text-5xl font-bold" duration={1.5} />
            <div className="font-mono text-[10px] tracking-[0.3em] text-slate-500">
              {terms.riskScoreCaption}
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
```

- [ ] **步骤 2：typecheck**

```bash
npm run typecheck
```

预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add components/xray/VerdictBanner.tsx
git commit -m "feat: VerdictBanner 双模式（PRO 去扫描线，术语随模式）"
```

---

### 任务 10：CharacterCard PRO 重绘（健康度环 + 指标网格）

**文件：**
- 修改：`components/xray/CharacterCard.tsx`
- 修改：`components/xray/HealthBar.tsx`（标签随模式）

- [ ] **步骤 1：HealthBar 标签走术语字典**

`components/xray/HealthBar.tsx` 中：import 改为 `import { scoreColor } from '@/lib/theme'`、`import { useTokens, useMode } from '@/lib/theme/use-tokens'`、`import { getTerms } from '@/lib/theme/terms'`；函数体内：

```tsx
export function HealthBar({ hp }: { hp: CompanyXRay['hp'] }) {
  const t = useTokens()
  const mode = useMode()
  const terms = getTerms(mode)
  const color = scoreColor(t, hp.score)
  const critical = hp.score < 30
```

并把 `HP · 财务血量` 替换为 `{terms.healthLabel}`。其余不动。

- [ ] **步骤 2：CharacterCard 双模式**

整文件替换：

```tsx
'use client'

import { motion } from 'framer-motion'
import { HealthBar } from './HealthBar'
import { HiddenStatusList } from './HiddenStatusList'
import { StatNumber } from './StatNumber'
import { formatWan } from '@/lib/utils'
import { scoreColor } from '@/lib/theme'
import { useMode, useTokens } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
import type { CompanyXRay } from '@/lib/types'

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

/** PRO：健康度环形仪表 + 2×2 指标网格（无血条、无霓虹） */
function ProCard({ xray }: { xray: CompanyXRay }) {
  const t = useTokens()
  const terms = getTerms('pro')
  const color = scoreColor(t, xray.hp.score)
  const metrics: { label: string; score: number; sub: string }[] = [
    { label: terms.defLabel, score: xray.def.score, sub: `${xray.def.label} · 质押 ${xray.def.pledgeRatio}%` },
    { label: terms.atkLabel, score: xray.atk.score, sub: `诉讼 ${xray.atk.lawsuitCount} 起 / 被执行 ${formatWan(xray.atk.executionAmount)}` },
    { label: '现金流强度', score: xray.hp.score, sub: `经营现金流 ${formatWan(xray.hp.cashFlow)}` },
    { label: terms.moraleLabel, score: xray.morale.score, sub: `avgTone ${xray.morale.avgTone}` },
  ]

  return (
    <div className="glass-card flex h-full flex-col gap-5 p-6">
      <div className="flex items-center gap-4">
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${color} 0 ${xray.hp.score * 3.6}deg, ${t.colors.edge} ${xray.hp.score * 3.6}deg 360deg)` }}
        >
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-ink-card">
            <StatNumber value={xray.hp.score} className="text-xl font-semibold text-slate-50" duration={1.2} />
            <span className="font-mono text-[9px] tracking-wider text-slate-500">健康度</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-slate-50">{xray.name}</div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
            {xray.stockCode ?? 'UNLISTED'} · {xray.industry}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="font-mono text-[10px] tracking-wider text-slate-500">{m.label}</p>
            <p className="mt-1 font-mono text-lg font-semibold" style={{ color: scoreColor(t, m.score) }}>
              <StatNumber value={m.score} duration={1} />
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-1">
        <div className="mb-2.5 flex items-center justify-between font-mono text-[11px] tracking-[0.25em] text-slate-500">
          {terms.hiddenTitle}
          <span className="text-grape">
            ×<StatNumber value={xray.hiddenStatus.length} duration={0.6} />
          </span>
        </div>
        <HiddenStatusList items={xray.hiddenStatus} />
      </div>
    </div>
  )
}

/** 角色卡主容器：LITE = 游戏风（头像 + HP 血条 + DEF/ATK/士气）；PRO = 终端仪表 */
export function CharacterCard({ xray }: { xray: CompanyXRay }) {
  const mode = useMode()
  const terms = getTerms(mode)

  if (mode === 'pro') return <ProCard xray={xray} />

  return (
    <div className="glass-card flex h-full flex-col gap-5 p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card border border-neon/30 bg-neon/5 text-2xl font-bold text-neon shadow-glow">
          {xray.name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-slate-50">{xray.name}</div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
            {xray.stockCode ?? 'UNLISTED'} · {xray.industry}
          </div>
        </div>
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

      <div className="mt-1">
        <div className="mb-2.5 flex items-center justify-between font-mono text-[11px] tracking-[0.25em] text-slate-500">
          {terms.hiddenTitle}
          <span className="text-grape">
            ×<StatNumber value={xray.hiddenStatus.length} duration={0.6} />
          </span>
        </div>
        <HiddenStatusList items={xray.hiddenStatus} />
      </div>
    </div>
  )
}
```

- [ ] **步骤 3：typecheck + Commit**

```bash
npm run typecheck
```

预期：无错误

```bash
git add components/xray/CharacterCard.tsx components/xray/HealthBar.tsx
git commit -m "feat: CharacterCard PRO 重绘（健康度环 + 指标网格），术语随模式"
```

---

### 任务 11：报告页卡片标题与页脚术语随模式

**文件：**
- 修改：`components/xray/XrayClient.tsx`

- [ ] **步骤 1：标题字典化**

在 `XrayClient.tsx` 顶部 import 区域加：

```tsx
import { useMode } from '@/lib/theme/use-tokens'
import { getTerms } from '@/lib/theme/terms'
```

并在组件内（`const section = ...` 之后、`export function` 体内第一行）加：

```tsx
  const mode = useMode()
  const titles = getTerms(mode).cardTitles
```

`lib/theme/terms.ts` 的 `Terms` 接口与两份字典各加：

```ts
  cardTitles: {
    radar: string
    cashflow: string
    lawsuit: string
    sentiment: string
    timeline: string
    graph: string
  }
```

```ts
  cardTitles: {
    radar: '五维属性雷达',
    cashflow: '经营现金流趋势',
    lawsuit: '诉讼热力图',
    sentiment: '舆情情绪曲线',
    timeline: '风险时间轴 · 近 12 个月',
    graph: '关系图谱',
  },
```

```ts
  cardTitles: {
    radar: '五维指标',
    cashflow: '经营现金流',
    lawsuit: '涉诉分布',
    sentiment: '舆情指数',
    timeline: '风险事件时间轴 · 近 12 个月',
    graph: '股权 / 关联网络',
  },
```

六个 `<CardTitle>...</CardTitle>` 分别替换为 `{titles.radar}`、`{titles.cashflow}`、`{titles.lawsuit}`、`{titles.sentiment}`、`{titles.timeline}`、`{titles.graph}`。

- [ ] **步骤 2：测试 + typecheck**

```bash
npm test && npm run typecheck
```

预期：全绿

- [ ] **步骤 3：Commit**

```bash
git add lib/theme/terms.ts components/xray/XrayClient.tsx
git commit -m "feat: 报告页卡片标题随模式切换术语"
```

---

### 任务 12：整体验证与收尾

**文件：**
- 修改：无（验证任务）

- [ ] **步骤 1：全量检查**

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

预期：全部通过

- [ ] **步骤 2：PRO 禁用项 grep 扫描**

```bash
grep -rn "animate-scanline\|shadow-glow\|text-glow" components/xray --include="*.tsx" | grep -v "mode === 'lite'\|mode==='lite'"
```

预期：仅 VerdictBanner.tsx 的 LITE 分支命中（扫描线）。其余 PRO 路径组件（CharacterCard ProCard、图表组件）不得出现 `shadow-glow` / `text-glow` / 硬编码 `0,229,255`。

```bash
grep -rn "0,229,255\|00E5FF" components/ lib/ --include="*.ts" --include="*.tsx"
```

预期：仅 `lib/theme/themes/lite.ts` 命中。

- [ ] **步骤 3：手动验收清单（npm run dev）**

- [ ] LITE 下视觉与 main 分支一致（ neon 青、发光、扫描线、血条 ）
- [ ] PRO 下：背景 #0B0F1A 实底卡片、无发光无扫描线、健康度环正常渲染
- [ ] 切换开关即时生效、刷新保持
- [ ] 3 家 mock 公司两模式下均不破版，图表 tooltip 颜色正常
- [ ] 断网/缺字段时 `ChartEmpty` 占位正常

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "chore: 双主题第一期收尾验证"
```

---

## 自检记录

- **规格覆盖度：** §3 tokens→任务 3/4；§4 双模式→任务 2/5/8；§5.1 组件→任务 9/10/11；§5.2 高级图表为规格明确的第二期，不在本计划；§5.4 分享卡 PRO 亦为第二期；§6 第一期=任务 1-12。§7 验收→任务 12。
- **占位符：** 无 TODO；所有代码步骤含完整代码。
- **类型一致性：** `Mode` 唯一定义于 `lib/mode-store.ts`，theme/types.ts 从这里 import；`scoreColor(t, score)`、`getTokens(mode)`、`getTerms(mode)`、`baseChartOptionFor(t)`、`baseAxisFor(t)`、`useTokens()`、`useMode()` 签名全计划一致；`Terms.cardTitles` 在任务 8 初版未含、任务 11 扩展，两处代码均已给出完整字段。
