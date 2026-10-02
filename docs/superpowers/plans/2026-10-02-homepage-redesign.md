# 首页重设计实现计划（中性单皮科技风）

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将首页重写为中性单皮科技风（ZoomEye 式搜索为中心），品牌更名「HERMES · 公司透视」，背景接入 2D canvas 粒子网络，扫描过场重绘中性蓝并压缩至 ~2s。

**架构：** 首页 `<main data-theme="home">` 挂局部主题作用域，`globals.css` 新增 `[data-theme='home']` 变量块并封堵全局主题的作用域穿透（glass-card blur / text-glow / scan-beam / shadow-glow）；Tailwind 颜色本就 `var()` 驱动，子树内组件自动染中性蓝。模式开关移到按路径条件渲染的 `SiteChrome`（首页隐藏）。

**技术栈：** Next.js 15 App Router · React 19 · Tailwind（CSS 变量驱动）· framer-motion · lucide-react · canvas 2D · vitest

**规格依据：** `docs/superpowers/specs/2026-10-02-homepage-redesign-design.md`（已批准）

---

## 文件清单

| 文件 | 动作 | 职责 |
|---|---|---|
| `lib/presets.ts` | 修改 | 新增 `filterPresets(query)` 纯函数（可单测） |
| `lib/__tests__/presets.test.ts` | 创建 | filterPresets 单测 |
| `globals.css` | 修改 | `[data-theme='home']` 变量块 + 4 处穿透封堵 |
| `components/home/NetworkBg.tsx` | 创建 | canvas 粒子网络背景（纯装饰） |
| `components/theme/SiteChrome.tsx` | 创建 | 按路径条件渲染 ModeToggle |
| `app/layout.tsx` | 修改 | metadata 更名 + 用 SiteChrome 替换固定 ModeToggle |
| `components/scan/ScanProgress.tsx` | 修改 | 步进 420ms→340ms，末行文案更名 |
| `app/page.tsx` | 重写 | 新首页结构 |

---

## 任务 1：filterPresets 搜索过滤（TDD）

**文件：**
- 修改：`lib/presets.ts`
- 测试：`lib/__tests__/presets.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `lib/__tests__/presets.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { filterPresets, PRESET_COMPANIES } from '@/lib/presets'

describe('filterPresets', () => {
  it('空串或纯空白返回全部预设', () => {
    expect(filterPresets('')).toEqual(PRESET_COMPANIES)
    expect(filterPresets('   ')).toEqual(PRESET_COMPANIES)
  })

  it('按名称子串匹配', () => {
    expect(filterPresets('蓝湾').map((c) => c.id)).toEqual(['mock-warning'])
  })

  it('按 tagline 匹配', () => {
    expect(filterPresets('白酒').map((c) => c.id)).toEqual(['mock-healthy'])
  })

  it('按 id 匹配且大小写不敏感', () => {
    expect(filterPresets('MOCK-DANGER').map((c) => c.id)).toEqual(['mock-danger'])
  })

  it('无匹配返回空数组', () => {
    expect(filterPresets('不存在的公司xyz')).toEqual([])
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test -- presets`
预期：FAIL，`filterPresets is not a function` 或等价报错。

- [ ] **步骤 3：编写最少实现**

在 `lib/presets.ts` 末尾追加（保留现有 `PresetCompany` 与 `PRESET_COMPANIES` 不动）：

```ts
/** 首页搜索过滤：空串返回全部；按名称/标语/ID 子串匹配（大小写不敏感） */
export function filterPresets(query: string): PresetCompany[] {
  const q = query.trim().toLowerCase()
  if (!q) return PRESET_COMPANIES
  return PRESET_COMPANIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.tagline.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q),
  )
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npm run test -- presets`
预期：PASS（5 个用例全绿）。

- [ ] **步骤 5：Commit**

```bash
git add lib/presets.ts lib/__tests__/presets.test.ts
git commit -m "feat: 首页搜索过滤提取为 filterPresets 纯函数（含单测）"
```

---

## 任务 2：globals.css 中性主题块与穿透封堵

**文件：**
- 修改：`globals.css`

- [ ] **步骤 1：追加 home 主题块**

在 `globals.css` 的 `[data-theme='pro'] { ... }` 块之后追加：

```css
[data-theme='home'] {
  --bg: #070b14;
  --card: rgba(16, 22, 37, 0.85);
  --card-solid: #101625;
  --edge: #1e2a42;
  --accent: #4c8dff;
  --danger: #ff5c6c;
  --warn: #ffb020;
  --safe: #3ecf8e;
  --grape: #8b5cf6;
  --text-main: #f4f6fa;
  --text-dim: #8b94ab;
  --text-faint: #66738e;
  --grid-line: rgba(139, 148, 171, 0.14);
  --grid-glow: rgba(76, 141, 255, 0.1);
  --grid-cell: rgba(139, 148, 171, 0.05);
}

/* ===== 首页中性皮：封堵全局主题作用域穿透（main[data-theme='home'] 前缀提权） ===== */
main[data-theme='home'] .glass-card {
  backdrop-filter: none;
}

main[data-theme='home'] .text-glow {
  text-shadow: 0 0 14px rgba(76, 141, 255, 0.55);
}

main[data-theme='home'] .text-glow-danger {
  text-shadow: 0 0 14px rgba(255, 92, 108, 0.55);
}

main[data-theme='home'] .scan-beam {
  background: linear-gradient(90deg, transparent, rgba(76, 141, 255, 0.9), transparent);
  box-shadow: 0 0 16px rgba(76, 141, 255, 0.8);
}

main[data-theme='home'] .shadow-glow {
  box-shadow: 0 0 24px rgba(76, 141, 255, 0.25);
}
```

说明：`main[data-theme='home']` 前缀（元素+属性+类）特异性高于全局的 `[data-theme='lite'] .glass-card` 等后代选择器，确保首页子树内中性值胜出。

- [ ] **步骤 2：验证编译**

运行：`npm run build`
预期：构建成功，无 CSS 报错。

- [ ] **步骤 3：Commit**

```bash
git add globals.css
git commit -m "feat: 首页中性主题作用域 data-theme=home 与全局主题穿透封堵"
```

---

## 任务 3：NetworkBg 粒子网络背景

**文件：**
- 创建：`components/home/NetworkBg.tsx`

- [ ] **步骤 1：编写组件**

创建 `components/home/NetworkBg.tsx`：

```tsx
'use client'

import { useEffect, useRef } from 'react'

const NODE_COUNT = 40
const LINK_DIST = 120
const DPR_CAP = 2

interface NetNode {
  x: number
  y: number
  vx: number
  vy: number
}

/** 首页背景：悬浮知识网络（纯装饰，2D canvas，无 WebGL；prefers-reduced-motion 时静态单帧） */
export function NetworkBg() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    let c: CanvasRenderingContext2D | null = null
    try {
      c = canvas.getContext('2d')
    } catch {
      return // 纯装饰：静默失败
    }
    if (!c) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    let width = parent.clientWidth
    let height = parent.clientHeight

    const nodes: NetNode[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
    }))

    const draw = () => {
      c!.clearRect(0, 0, width, height)
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > width) n.vx *= -1
        if (n.y < 0 || n.y > height) n.vy *= -1
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
          if (d < LINK_DIST) {
            c!.strokeStyle = `rgba(76, 141, 255, ${0.28 * (1 - d / LINK_DIST)})`
            c!.lineWidth = 1
            c!.beginPath()
            c!.moveTo(nodes[i].x, nodes[i].y)
            c!.lineTo(nodes[j].x, nodes[j].y)
            c!.stroke()
          }
        }
      }
      c!.fillStyle = 'rgba(160, 195, 255, 0.85)'
      for (const n of nodes) {
        c!.beginPath()
        c!.arc(n.x, n.y, 1.6, 0, Math.PI * 2)
        c!.fill()
      }
    }

    const resize = () => {
      width = parent.clientWidth
      height = parent.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      c!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    let raf = 0
    if (reduced) {
      draw()
    } else {
      const loop = () => {
        draw()
        raf = requestAnimationFrame(loop)
      }
      loop()
    }

    const onResize = () => {
      resize()
      if (reduced) draw()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-0" aria-hidden="true" />
}
```

- [ ] **步骤 2：类型检查**

运行：`npm run typecheck`
预期：无报错。

- [ ] **步骤 3：Commit**

```bash
git add components/home/NetworkBg.tsx
git commit -m "feat: 首页粒子网络背景 NetworkBg（canvas 2D，reduced-motion 静态化）"
```

---

## 任务 4：SiteChrome 条件渲染 + layout 更名

**文件：**
- 创建：`components/theme/SiteChrome.tsx`
- 修改：`app/layout.tsx`

- [ ] **步骤 1：编写 SiteChrome**

创建 `components/theme/SiteChrome.tsx`：

```tsx
'use client'

import { usePathname } from 'next/navigation'
import { ModeToggle } from '@/components/theme/ModeToggle'

/** 全站挂件：首页为中性单皮不显示模式开关，其余页面显示 */
export function SiteChrome() {
  const pathname = usePathname()
  if (pathname === '/') return null
  return (
    <div className="fixed right-4 top-4 z-50">
      <ModeToggle />
    </div>
  )
}
```

- [ ] **步骤 2：修改 layout.tsx**

将 `app/layout.tsx` 全文替换为：

```tsx
import type { Metadata, Viewport } from 'next'
import { ThemeSync } from '@/components/theme/ThemeSync'
import { SiteChrome } from '@/components/theme/SiteChrome'
import './globals.css'

export const metadata: Metadata = {
  title: 'HERMES · 公司透视',
  description: '输入公司名，30 秒生成一张公司透视报告：财务/司法/舆情/股权四维尽调一次看清。',
}

export const viewport: Viewport = {
  themeColor: '#070B14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-grid min-h-screen">
        <ThemeSync />
        <SiteChrome />
        {children}
      </body>
    </html>
  )
}
```

变更点：metadata 标题与描述更名；`ModeToggle` 的固定容器替换为 `<SiteChrome />`（首页自动隐藏）。

- [ ] **步骤 3：类型检查**

运行：`npm run typecheck`
预期：无报错。

- [ ] **步骤 4：Commit**

```bash
git add components/theme/SiteChrome.tsx app/layout.tsx
git commit -m "feat: 模式开关改为按路径条件渲染，首页隐藏；站点更名 HERMES · 公司透视"
```

---

## 任务 5：ScanProgress 时长与文案

**文件：**
- 修改：`components/scan/ScanProgress.tsx:8,23,43`

- [ ] **步骤 1：修改三处**

1. `STAGES` 末行 `'生成 X 光片 …'` → `'生成透视报告 …'`；
2. `setTimeout(() => setStep((s) => s + 1), 420)` 的 `420` → `340`；
3. 其余不动。

- [ ] **步骤 2：回归确认**

运行：`npm run test`
预期：既有用例（mode-store / terms / theme-tokens / smoke / presets）全部 PASS——本改动无测试覆盖，靠任务 7 的手工回归。

- [ ] **步骤 3：Commit**

```bash
git add components/scan/ScanProgress.tsx
git commit -m "feat: 扫描过场压缩至 ~2s 并更名「生成透视报告」"
```

---

## 任务 6：page.tsx 重写

**文件：**
- 重写：`app/page.tsx`

- [ ] **步骤 1：替换全文**

将 `app/page.tsx` 全文替换为：

```tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Coins, Crosshair, Megaphone, Network, Scale, Search } from 'lucide-react'
import { NetworkBg } from '@/components/home/NetworkBg'
import { ScanBeam } from '@/components/scan/ScanBeam'
import { ScanProgress } from '@/components/scan/ScanProgress'
import { Badge } from '@/components/ui/badge'
import { filterPresets, type PresetCompany } from '@/lib/presets'

const HINT_VARIANT = { 稳健白马: 'safe', 争议成长: 'warn', 高危预警: 'danger' } as const

const CAPABILITIES = [
  { icon: Coins, label: '财务', note: '现金流与负债' },
  { icon: Scale, label: '司法', note: '涉诉与执行' },
  { icon: Megaphone, label: '舆情', note: '情绪与声量' },
  { icon: Network, label: '股权', note: '关联与控制' },
] as const

export default function HomePage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [scanning, setScanning] = useState<PresetCompany | null>(null)

  const matches = useMemo(() => filterPresets(query), [query])

  const startScan = (company: PresetCompany) => {
    if (scanning) return
    setScanning(company)
  }

  return (
    <main data-theme="home" className="relative flex min-h-screen flex-col overflow-hidden">
      <NetworkBg />

      {/* 顶栏 */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <span className="font-mono text-xs tracking-[0.25em] text-slate-400">HERMES</span>
        <span className="font-mono text-[11px] text-slate-600">v0.9 · DEMO</span>
      </header>

      {/* Hero + 搜索 + 热门扫描 */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <div className="mb-4 font-mono text-[11px] tracking-[0.35em] text-neon/80">
            HERMES SYSTEM ONLINE
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-slate-50">公司透视</h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            输入公司名，30 秒生成一张公司透视报告 —— 财务、司法、舆情、股权，散落线索一次看清。
          </p>
        </motion.div>

        {/* 搜索框 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card flex w-full max-w-xl items-center gap-3 px-5 py-4"
        >
          <Search className="h-5 w-5 text-neon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入公司名称或股票代码…"
            className="w-full bg-transparent font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <Crosshair className="h-4 w-4 animate-blink text-neon/60" />
          <span className="font-mono text-[11px] tracking-wider text-neon">SCAN ⏎</span>
        </motion.div>

        {/* 热门扫描榜单 */}
        <div className="mt-6 w-full max-w-xl">
          <AnimatePresence>
            {matches.map((c, i) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                onClick={() => startScan(c)}
                className="glass-card glass-card-hover mb-3 flex w-full items-center gap-4 px-5 py-3.5 text-left"
              >
                <span className="font-mono text-sm text-neon">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex-1">
                  <div className="font-semibold text-slate-100">{c.name}</div>
                  <div className="mt-0.5 font-mono text-xs text-slate-500">{c.tagline}</div>
                </div>
                <Badge variant={HINT_VARIANT[c.hint]}>{c.hint}</Badge>
              </motion.button>
            ))}
          </AnimatePresence>
          {matches.length === 0 && (
            <div className="glass-card py-6 text-center font-mono text-xs text-slate-500">
              未收录该公司 —— 演示版仅支持 3 家预设企业（真实数据源接入见 docs/DOC-A）
            </div>
          )}
        </div>
      </div>

      {/* 底部能力带 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="relative z-10 grid grid-cols-4 border-t border-ink-edge bg-[#070B14]/60"
      >
        {CAPABILITIES.map((cap) => (
          <div
            key={cap.label}
            className="flex flex-col items-center gap-0.5 border-r border-ink-edge px-2 py-5 last:border-r-0"
          >
            <cap.icon className="mb-1 h-5 w-5 text-neon/80" />
            <div className="text-[13px] font-semibold text-slate-100">{cap.label}</div>
            <div className="text-xs text-slate-500">{cap.note}</div>
          </div>
        ))}
      </motion.div>

      {/* footer */}
      <div className="relative z-10 border-t border-ink-edge py-3 text-center font-mono text-[11px] text-slate-600">
        DATA: MOCK / AKSHARE / CNINFO / JUHE / GDELT · 仅供演示
      </div>

      {/* 扫描过场 */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-bg/95 backdrop-blur-sm"
          >
            <ScanBeam />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-card w-full max-w-md p-8"
            >
              <ScanProgress companyName={scanning.name} onDone={() => router.push(`/report/${scanning.id}`)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
```

- [ ] **步骤 2：类型检查 + 构建**

运行：`npm run typecheck && npm run build`
预期：均成功，无报错。

- [ ] **步骤 3：Commit**

```bash
git add app/page.tsx
git commit -m "feat: 首页重写为中性单皮科技风（搜索为中心 + 粒子网络 + 四维能力带）"
```

---

## 任务 7：整体验收

**文件：** 无新增（验证任务）

- [ ] **步骤 1：全量测试与静态检查**

运行：`npm run test && npm run lint && npm run typecheck`
预期：全部通过。

- [ ] **步骤 2：硬编码残留 grep**

运行（Git Bash）：`git grep -n -E "rgba\(0, *229, *255|0,229,255" -- app/page.tsx components/home components/scan/ScanProgress.tsx`
预期：无输出（无霓虹青硬编码残留）。

- [ ] **步骤 3：手工走查（dev server）**

运行：`npm run dev`，浏览器打开 `http://localhost:3000` 逐项确认：

1. 首屏：顶栏 HERMES / v0.9·DEMO，无模式开关；标题「公司透视」+ 副标题；搜索框；热门扫描 3 行带序号与风味徽章；底部能力带四栏；footer 数据源行；
2. 输入「蓝湾」→ 榜单即滤到蓝湾咖啡；输入「不存在的公司」→ 空态文案出现；清空 → 恢复 3 行；
3. 右上角无模式开关；直接访问 `/report/mock-healthy` → 报告页右上角开关可见且 LITE/PRO 切换正常；
4. 点击「恒晟地产」→ 全屏中性蓝过场，5 行日志逐行点亮（末行「生成透视报告」），~2s 后跳转 `/report/mock-danger`；
5. 系统级开启「减弱动画」（Windows：设置 → 辅助功能 → 显示动画效果关闭）→ 刷新首页，粒子背景为静态单帧，页面功能正常；
6. 切 LITE/PRO（在报告页切换后回首页）→ 首页视觉零变化；
7. 报告页过场回归：从报告页触发的扫描动画渲染正常（ScanBeam/ScanProgress 复用）。

- [ ] **步骤 4：Lighthouse（可选）**

运行：`npx lighthouse http://localhost:3000 --only-categories=performance,accessibility,best-practices,seo`
预期：Performance ≥ 80。

---

## 计划自检记录

- **规格覆盖度：** §3 主题作用域→任务 2；§4 结构文案→任务 6；§5 NetworkBg→任务 3；§5 SiteChrome/layout→任务 4；§5 ScanProgress→任务 5；§5 filterPresets→任务 1；§6 交互边界→任务 6/7 走查项；§8 测试→任务 1；验收 grep→任务 7 步骤 2。无遗漏。
- **类型一致性：** `filterPresets(query: string): PresetCompany[]`（任务 1 定义，任务 6 以 `useMemo(() => filterPresets(query), [query])` 调用）；`NetworkBg` 无 props（任务 3 定义，任务 6 直接用）；`SiteChrome` 无 props（任务 4 定义，layout 使用）；`HINT_VARIANT` 键与 `PresetCompany['hint']` 联合类型一致。
- **已知取舍：** `bg-ink-bg/95` 沿用现有写法（Tailwind 对 var 颜色的 opacity 修饰符行为与现状一致）；能力带底色用字面量 `bg-[#070B14]/60` 规避该不确定性（home 作用域底色固定）。
