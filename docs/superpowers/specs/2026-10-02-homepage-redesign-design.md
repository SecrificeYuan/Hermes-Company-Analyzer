# 设计规格 · 首页重设计（中性单皮科技风）

> 日期：2026-10-02 · 分支：`feat/design-language`
> 前置规格：[2026-10-02-design-language-design.md](./2026-10-02-design-language-design.md)（双主题设计语言）
> 状态：已获用户批准

---

## 1. 背景与目标

首页是全站唯一未接入设计体系的页面：`app/page.tsx` 仍硬编码霓虹科幻风（`text-neon` / `text-glow` / `animate-blink` 观感），与报告页双模式皮肤割裂；首屏层级弱、说服力不足、游戏感过重。用户指定参考 [ZoomEye](https://www.zoomeye.org) 的克制科技感。

**目标：**

1. 首页重定位为**中性单皮科技风**（不接 LITE/PRO 双模式），消除进出报告的撕裂感；
2. ZoomEye 式构图：搜索为绝对主角，一屏讲完产品价值；
3. 品牌升级：主标题改为「HERMES · 公司透视」，去游戏化；
4. 扫描过场保留仪式感但重绘为中性蓝，时长压缩至 ~2s。

**非目标（YAGNI）：** 浅色主题；改数据契约；动报告页 / 对比页任何组件；分享卡（已 grep 确认不含旧品牌名）；首页不做 LITE/PRO 换肤。

## 2. 访谈定案（决策记录）

| 维度 | 决策 |
|---|---|
| 模式策略 | 首页中性单皮，`data-theme="home"` 局部作用域；模式开关仅报告/对比页可见 |
| 结构 | 一屏：hero → 搜索 → 热门扫描榜单 → 底部四维能力带 → footer |
| 背景 | 悬浮知识网络：2D canvas 粒子网络（无 WebGL），蓝 `#4C8DFF` 近距连线 |
| 扫描过场 | 保留全屏过场，重绘中性蓝，步进间隔 420ms→340ms（总 ~2s） |
| 命名 | 主标题「公司透视」，eyebrow「HERMES SYSTEM ONLINE」保留 |
| 副标题 | 「输入公司名，30 秒生成一张公司透视报告 —— 财务、司法、舆情、股权，散落线索一次看清」 |
| 榜单标签 | 保留风味标签：稳健白马 / 争议成长 / 高危预警，配语义色 |

## 3. 主题作用域

首页根节点 `<main data-theme="home">`。`globals.css` 新增 `[data-theme='home']` 变量块，Tailwind 颜色（`neon: var(--accent)`、`ink.*` 等）在首页子树内自动解析为中性值；全局 `<html data-theme="lite|pro">` 的切换对首页零影响。

**已知泄漏点必须显式封堵**（`[data-theme]` 后代选择器会穿透子树，例如全局 lite 时 `[data-theme='lite'] .glass-card { backdrop-blur }` 仍命中首页卡片）。home 块内显式重置：

- `.glass-card` → `backdrop-filter: none`（home 下卡片为实底微透明，不用玻璃拟态）；
- `.text-glow` / `.text-glow-danger` → 阴影色改读 `var(--accent)` / `var(--danger)` 的 rgba；
- `.scan-beam` → 光束色改读 `var(--accent)`；
- `shadow-glow*` → home 作用域内用 `box-shadow: 0 0 24px rgba(76,141,255,0.25)` 中性覆盖（仅过场进度条使用）。

### 中性色板

| Token | 值 | 说明 |
|---|---|---|
| `--bg` | `#070B14` | 页面底（深海蓝黑，对齐 ZoomEye） |
| `--card` | `rgba(16,22,37,0.85)` | 面板（盖在粒子网络上，需微透明） |
| `--card-solid` | `#101625` | 实底（进度条槽等） |
| `--edge` | `#1E2A42` | 描边 / 分隔线 |
| `--accent` | `#4C8DFF` | 唯一品牌点缀：搜索图标、序号、SCAN、扫描过场 |
| `--safe` / `--warn` / `--danger` | `#3ECF8E` / `#FFB020` / `#FF5C6C` | 语义色，沿用 PRO 值 |
| `--text-main` / `--text-dim` / `--text-faint` | `#F4F6FA` / `#8B94AB` / `#66738E` | 文字三级 |
| `--grid-line` | `rgba(139,148,171,0.14)` | 备用网格线 |
| `--grid-glow` | `rgba(76,141,255,0.10)` | 顶部极弱蓝色光晕（body 背景用） |
| `--grid-cell` | `rgba(139,148,171,0.05)` | body 网格单元 |

body 的 `.bg-grid` 背景在 home 子树下自然解析为蓝色调，无需额外处理。

## 4. 页面结构与文案

```
┌─────────────────────────────────────────┐
│ HERMES                        v0.9·DEMO │  ← 顶栏（无模式开关）
│                                         │
│        HERMES SYSTEM ONLINE             │  ← eyebrow，11px mono 字距 .35em
│            公司透视                      │  ← H1 仅「公司透视」44px/700；
│                                         │    HERMES 品牌由 eyebrow+顶栏承担
│   输入公司名，30 秒生成一张公司透视报告     │  ← 副标题 14px/1.7
│   财务、司法、舆情、股权，散落线索一次看清   │
│                                         │
│  [🔍 输入公司名称或股票代码…        SCAN]│  ← 搜索框（live-filter）
│                                         │
│  ┌ 热门扫描 ─────────────────────────┐  │
│  │ 01  赤水河酒业  白酒龙头·现金奶牛  [稳健白马]│ │
│  │ 02  蓝湾咖啡    万店神话·争议缠身  [争议成长]│ │
│  │ 03  恒晟地产    债务高压·暴雷前兆  [高危预警]│ │
│  └──────────────────────────────────┘  │
│                                         │
│ ┌ 财务 ┬ 司法 ┬ 舆情 ┬ 股权 ┐            │  ← 底部能力带：图标+名+一句大白话
│ 现金流与负债│涉诉与执行│情绪与声量│关联与控制│
│ └──────┴──────┴──────┴──────┘            │
│  DATA: MOCK / AKSHARE / CNINFO / JUHE / │
│  GDELT · 仅供演示                        │
└─────────────────────────────────────────┘
```

- **顶栏**：左侧 HERMES mono 字标，右侧 `v0.9 · DEMO`（不新增导航链接，YAGNI）。
- **热门扫描**：序号 `01/02/03`（JetBrains Mono，`--accent`）；公司名 15px/600；tagline 12px faint；风味徽章 = 语义色 12% 底 + 同色描边。
- **能力带**：四栏等分，栏间细分隔线，lucide 图标：**Coins（财务·现金流与负债）/ Scale（司法·涉诉与执行）/ Megaphone（舆情·情绪与声量）/ Network（股权·关联与控制）**。
- **footer**：数据源行沿用，11px faint 居中。

## 5. 文件改动清单

| 文件 | 动作 | 内容 |
|---|---|---|
| `app/page.tsx` | 重写 | §4 结构；交互逻辑沿用现有（`useState` query / `startScan` / `AnimatePresence` 过场） |
| `components/home/NetworkBg.tsx` | 新增 | canvas 粒子网络背景（纯装饰） |
| `app/layout.tsx` | 改 | metadata 标题 → `HERMES · 公司透视`；ModeToggle 移出，换 `<SiteChrome />` |
| `components/theme/SiteChrome.tsx` | 新增 | client 组件，`usePathname()`，路径 `/` 时不渲染 ModeToggle，其余路径渲染 |
| `components/scan/ScanProgress.tsx` | 改 | 步进间隔 340ms；末行「生成 X 光片 …」→「生成透视报告 …」；样式类不动 |
| `lib/presets.ts` | 改 | 新增导出 `filterPresets(query): PresetCompany[]`（空串返回全部；按 name/tagline/id 子串匹配，大小写不敏感） |
| `globals.css` | 改 | `[data-theme='home']` 变量块 + §3 泄漏封堵重置 |
| `lib/__tests__/presets.test.ts` | 新增 | `filterPresets` 单测 |

## 6. 组件规格

### 6.1 NetworkBg（粒子网络背景）

- `<canvas>` 绝对定位 `inset-0`，`z-0`，`pointer-events-none`；内容层 `z-10`。
- ~40 节点，速度 ≤0.35px/帧，边界反弹；距离 <120px（按 1440 宽归一）连线，线透明度随距离衰减（最大 0.28）。
- 节点 1.6px 圆点 `rgba(160,195,255,0.85)`；线 `rgba(76,141,255,α)`。
- `prefers-reduced-motion: reduce` → 渲染静态单帧，不开 rAF。
- DPR 上限 2；组件卸载停 rAF；`document.hidden` 时 rAF 自然暂停，不额外处理。
- 纯装饰：初始化异常 try/catch 静默，页面功能不受影响。

### 6.2 搜索框与榜单

- 输入即滤（`filterPresets`），匹配字段：name / tagline / id。
- 空结果：面板内空态「未收录该公司 —— 演示版仅支持 3 家预设企业（真实数据源接入见 docs/DOC-A）」。
- 回车不触发跳转（demo 仅支持点选预设）；不做输入防抖（本地 3 条数据）。
- 榜单项 hover：仅描边色加深为 `--accent`，无位移无发光。

### 6.3 扫描过场

- 结构与现有一致：全屏遮罩（`bg-ink-bg/95`，token 驱动）+ blur + 居中面板 + 终端日志步进 + 进度条。
- 5 行阶段文案沿用（接入财务数据源 / 抓取公告与涉诉记录 / 聚合舆情情绪 / 运行四维打分与隐藏状态规则 / 生成透视报告），间隔 340ms，完成后 300ms 跳转。
- 样式全部走 token：`text-neon`→`--accent`、`bg-ink-card`→`--card-solid`；`shadow-glow` 经 §3 中性覆盖。

### 6.4 动效规范

- 入场：framer-motion 淡入 + 位移 ≤16px，stagger 0.05s（沿用现有模式）。
- 全页无发光呼吸、无扫描线常驻动画（仅过场光束动画保留）。
- 能力带与 footer 无入场动画（首屏内容已足够，避免过度表演）。

## 7. 错误处理与边界

- canvas 初始化失败 / 2D 上下文不可用：静默跳过，页面其余功能正常。
- `prefers-reduced-motion`：粒子静态化；过场保留（产品核心仪式，时长短）。
- 榜单空态见 §6.2；`localStorage` 模式偏好读写不受首页改动影响。
- 报告页 / 对比页不引用 `data-theme="home"`，零回归。

## 8. 测试与验收

**单元测试**（vitest，放 `lib/__tests__/presets.test.ts`）：

- `filterPresets('')` 返回 3 家全部；
- 按名称子串匹配（如「蓝湾」→ 蓝湾咖啡）；
- 按 tagline 匹配（如「白酒」→ 赤水河酒业）；
- 按 id 匹配（如「mock-danger」→ 恒晟地产）；
- 无匹配返回空数组；
- 大小写不敏感（如「MOCK-DANGER」可命中）。

**验收标准**：

- [ ] 全站切 LITE/PRO，首页视觉零变化；
- [ ] grep 验证首页子树（page.tsx + NetworkBg）无 `text-glow` 原生青色、`rgba(0,229,255` 等硬编码残留（§3 重置除外）；
- [ ] 3 家预设公司渲染不破版，空态文案正确；
- [ ] 点击预设 → 中性蓝过场 ~2s → 跳转 `/report/[id]`；
- [ ] `prefers-reduced-motion` 下粒子静态、页面可用；
- [ ] 报告页 / 对比页模式开关照常，功能无回归；
- [ ] Lighthouse ≥ 80 不回归。

## 9. 风险与约束

- **作用域穿透**是最大隐患：`[data-theme]` 后代选择器（`.glass-card` blur、`.text-glow` 色值）必须按 §3 在 home 块内重置，实现后逐条核对；
- ScanProgress 被报告页复用 —— 改步进间隔与文案会影响报告页过场；两处共用同一产品叙事，属可接受的一致性变更，但需回归报告页过场；
- 更名仅波及 `layout.tsx` metadata 与首页文案，分享卡已确认不含旧品牌名，无需连带改动。
