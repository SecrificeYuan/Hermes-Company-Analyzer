# 设计规格 · /compare 对比页重设计（LITE 对战台 / PRO 对比模块流）

> 日期：2026-10-02 · 分支：`feat/design-language`
> 前置规格：`2026-10-02-design-language-design.md`（双主题、术语字典、组件模式）
> 本期定位：设计语言第二期第 6 项「对比页双圈雷达 + diff」的完整页面重设计。

---

## 1. 背景与目标

现状 `/compare` 为基线实现：双下拉选公司 + 并排两张分数条卡片，纯 LITE 霓虹风，未接主题 tokens 与术语字典。页面 TODO 遗留「叠加双雷达、风险分项 diff、胜负判定动画」。

**目标：**

1. 双模式重设计：LITE = 游戏化对战台（唯一保留胜负判定的模式）；PRO = 多图表专业数据对比，并预留 LLM 分析组件位（后续版本接入真实分析结果）；
2. 落地规格已定的双圈对比雷达（重叠弱化、差异高亮、逐项 diff 箭头）；
3. 支持 URL 参数直达/分享对比结果。

**非目标（YAGNI）：** 胜负判定动画进 PRO；舆情置信波动带（契约无置信字段，不改契约）；LLM 真实接入（仅占位）；浅色主题。

## 2. 已确认决策（ brainstorming 结论）

| 决策点 | 结论 |
|---|---|
| 胜负判定 | 仅 LITE 呈现。判定逻辑两模式共用：`riskScore` 低者胜；两家分差 ≤3 为平局（DRAW） |
| LITE 内容 | 对战台完整版：判定横幅 → 三列对战台（角色卡 A ｜ VS 带 ｜ 角色卡 B）→ 双圈雷达 → 双方诊断点评 |
| PRO 内容 | 综合对比条 → LLM 占位卡 → 双圈雷达 → 指标对比表 → 趋势双线 ⇄ 风险事件对比（两列） |
| LLM 预留位 | 置顶：结论条之后、雷达之前 |
| 选择器 | 保留「开战」按钮 + URL 参数 `?a=&b=`，带参进入自动开战，可复制对比链接 |
| 页面结构 | LITE 三列对阵 / PRO 纵向模块流（浏览器线框已确认） |

## 3. 页面结构、路由与状态机

**路由**：`/compare` 单页客户端渲染。进入时读 `?a=&b=`：两个 id 均在 `PRESET_COMPANIES` 内且互异 → 自动开战；非法或缺失 → 静默回初始态。选择器变更或开战成功后 `router.replace` 同步 URL（不新增历史）。

**骨架**（模式感知，同一组件树）：

- 公共区：返回 ｜ 模式感知标题 ｜ 选择器横栏（A/B 下拉 + 主按钮 + 复制对比链接）
- LITE 结果区：判定横幅 → 三列对战台 → 双圈雷达（整行）→ 双方诊断点评（两家 `verdict` 引述并排，不生成新文案）
- PRO 结果区：综合对比条 → LLM 占位卡 → 双圈雷达 → 指标对比表 → 趋势双线 ⇄ 风险事件对比（桌面两列，移动端堆叠）

**状态机**：

| 状态 | 触发 | 表现 |
|---|---|---|
| idle | 无参数进入 / 参数非法 | 选择器 + 空态引导文案 |
| loading | 点开战 / 带参进入 | 结果区骨架屏，选择器与按钮禁用 |
| result | 双路 fetch 成功 | 按模式渲染，`compareVerdict` 判定 |
| draw | riskScore 分差 ≤3 | LITE「势均力敌」中性横幅，双卡同亮度无动效；PRO「基本一致」 |
| error | 任一路失败 | 错误条 + 重试按钮（重跑同两家），选择保留 |
| 同公司 | A=B | 主按钮禁用 + 提示 |

模式切换：结果保留直接换皮，不重新 fetch。

## 4. 组件拆分

新建 `components/compare/`（page.tsx 只持状态机 + 组合；子组件纯展示、props 驱动，模式差异走 `useTokens()` + `getTerms(mode)`）：

| 组件 | 职责 |
|---|---|
| `CompareSelector.tsx` | 选择器横栏：A/B 下拉 + 主按钮 + 复制对比链接 |
| `CompareVerdictBar.tsx` | 判定横幅（LITE 战报风 / PRO 克制对比条） |
| `DualRadar.tsx` | 双圈对比雷达 ★ 核心新图表 |
| `MetricCompareTable.tsx` | 指标对比表（维度 × A/B/差值 + 行内 Sparkline） |
| `TrendCompare.tsx` | 趋势双线对比（现金流 + 舆情，双 grid） |
| `RiskCompare.tsx` | 风险事件对比（两家清单并排，行点击展开证据） |
| `LlmPlaceholder.tsx` | LLM 占位卡（虚线框 + 即将上线） |

**复用（不新建）**：`CharacterCard`（LITE 角色卡）、`EChart` + `baseChartOptionFor`、`ui/skeleton` / `ui/badge` / `ui/button` / `ui/card`、`EvidenceDrawer`（RiskCompare 证据展开）。

**边界约定**：compare 组件只认 `props`（最宽 `{ a: CompanyXRay; b: CompanyXRay }`），不 fetch、不读 URL；单模块数据缺失自渲染空态（`ChartEmpty` 模式），模块崩不拖垮整页。

## 5. 关键交互

**胜负动效（仅 LITE，一次性入场，不循环）**：双卡两侧滑入（stagger 0.1s）→ VS 带翻转 → 判定横幅展开。胜者卡主题绿描边 + LITE 发光（`shadow-glow`）；败者卡亮度压暗 70%。DRAW 无胜负标记。PRO 仅淡入（0.2s），符合 PRO 禁用清单。

**复制对比链接**：`navigator.clipboard` 复制当前完整 URL；按钮文案变「已复制 ✓」1.5s 还原；clipboard 不可用时降级提示手动复制。

## 6. 图表技术要点

**DualRadar（两模式共用，皮肤随主题）**
- 单 radar 坐标系双 series：A = 主题 accent，B = `text-dim` 系中性色（不借 safe/danger，避免语义误读）；填充 A 22% / B 15%，描边 A 2px / B 1.5px；hover 圈加粗（emphasis）。
- 五维口径与单公司版一致：`[hp, def, atk, morale, 100 - riskScore]`，维度名走 `terms.radarIndicators`。
- 逐项 diff：图下方 5 个 diff chip（`维度 · A值 vs B值 · ▲差值`），▲▼ 按「对 A 有利/不利」着色。

**MetricCompareTable（PRO）**
- 行 = 契约全量：四维分 + 明细（现金流/负债率、质押比例/资产覆盖率、诉讼数/执行金额、平均 tone）+ riskScore + 稳健。
- **每行声明 `direction`**，差值列按「对 A 有利 → safe / 不利 → danger」着色，不做简单正负着色。方向表（依据 `lib/analysis/analyze.ts` 的 composite 公式 `(100 - atk.score)` 等契约语义）：

| 行 | direction |
|---|---|
| hp.score 健康度 / hp.cashFlow 经营现金流 | higher-better |
| hp.debtRatio 资产负债率 | lower-better |
| def.score 偿债安全垫 / def.assetCoverage 资产覆盖率 | higher-better |
| def.pledgeRatio 质押比例 | lower-better |
| atk.score 涉诉风险 / atk.lawsuitCount 诉讼数 / atk.executionAmount 执行金额 | lower-better |
| morale.score 舆情指数 / morale.avgTone 平均 tone | higher-better |
| riskScore | lower-better |
| 稳健（100 - riskScore） | higher-better |

- 有 `trend` 的行内嵌 40px 双色 Sparkline（现金流多年、舆情 12 月）；数字一律 JetBrains Mono。

**TrendCompare（PRO）**
- 单 EChart 双 grid：上 = 经营现金流多年双线（A 实线 / B 虚线），下 = 舆情指数 12 月双线。
- x 轴标签优先用 v1.1 `labels`，缺失回退序号。

**RiskCompare（PRO）**
- 两列各列一家 `hiddenStatus`：severity 色点 + label + 描述截断；点击行就地展开证据（复用 `EvidenceDrawer`）；一家无事件显「无记录」。

**LlmPlaceholder**：金融蓝虚线框卡，✦ + 「AI 深度对比」+「基于大模型的多维度归因分析 · 即将上线」，纯展示无交互。

## 7. 术语字典扩展

`Terms` 接口新增 `compare` 分组（LITE / PRO）：

| 字段 | LITE | PRO |
|---|---|---|
| `title` | 双公司对战 | 双公司对比 |
| `action` / `actionLoading` | 开战 / 分析中… | 开始对比 / 对比分析中… |
| `winnerTemplate` | {name} 胜 · 更健康 | {name} 综合占优 |
| `drawLabel` | 势均力敌 | 基本一致 |
| `idleHint` | 选两家公司，看看谁更健康 | 选择两家公司开始对比 |
| `copyLink` / `copied` / `retry` | 复制对比链接 / 已复制 ✓ / 重试 | 同左 |
| `slotLabel` | PLAYER {slot} | 公司 {slot} |
| `cardTitles.table` / `.trend` / `.risk` | 关键指标对比 / 趋势对决 / 风险状态对决 | 关键指标对比 / 趋势对比 / 风险事件对比 |
| `llmTitle` / `llmHint` | AI 深度对比 / 大模型多维归因 · 即将上线 | 同左 |

「复制对比链接」按钮仅 result 态出现（idle 时无参数可复制）。

## 8. 契约与判定逻辑

- `CompanyXRay` 零改动；URL 参数纯前端；LLM 组件无数据依赖。
- 本期消费的字段全部在契约内（含 v1.1 可选字段，缺失按 §6 回退）。
- 判定纯函数 `compareVerdict(aScore: number, bScore: number): 'A' | 'B' | 'draw'`（分差 ≤3 为 draw），放 `lib/analysis/`，页面与测试共用。

## 9. 测试与验收

- **单测（vitest）**：`compareVerdict` 边界（>3、=3、<3、极端分）；URL 参数校验函数（合法 / 非法 / 相同 id）。
- **手动验收**：
  - [ ] mock 3 家两两组合 × 两模式渲染不破版，空态正常
  - [ ] 带参进入自动开战；复制链接可还原同一对比
  - [ ] 断网 / 非法 id / 同公司三态表现正常
  - [ ] PRO 下全页无霓虹青/发光/扫描线残留（grep 验证）
  - [ ] 模式切换结果保留、直接换皮
  - [ ] Lighthouse ≥80 不回归

## 10. 风险与约束

- 差值着色方向表（`direction`）需逐行核对契约语义，错一行即误导，实现时以契约注释为准；
- mock 仅 3 家公司，DRAW 态要靠构造数据验证（如临时造两个 riskScore 相近的 mock）；
- 双圈雷达第二色不借用语义色，避免「B 家是红色=危险」的误读。
