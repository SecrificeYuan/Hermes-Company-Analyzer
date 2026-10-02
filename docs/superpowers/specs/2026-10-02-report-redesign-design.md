# /report 页面重设计规格 — 风险叙事版式 × 双密度阅读流

- 日期：2026-10-02
- 分支：feat/design-language（设计语言的第二期工程，与第一期双模式规格 `2026-10-02-design-language-design.md` 衔接）
- 状态：已通过头脑风暴全部决策点，待实现计划

## 1. 背景与动机

第一期双模式设计语言落地后，单组件品质已就位，但页面级存在三个结构性问题：

1. **页面级视觉普通**：`max-w-7xl` 卡片网格是典型 dashboard 安全牌，缺乏记忆点。
2. **阅读流不顺**：单一层级平铺所有图表，既无"一眼可见"的速览层，也无"结构化详读"的下钻层。参考威胁情报报告（微步类 TI 平台）：顶部元信息摘要 + 锚点导航 + 结构化详读区。
3. **图表与数据密度不足**：专业受众需要明细表格与更多图型；普通受众需要零专业门槛的解读。

## 2. 目标与非目标

**目标**

- 两层阅读流：上方**速览层**（多图表一眼可见）+ 下方**详读层**（结构化区块）。
- **风险叙事版式系统**：页面结构随公司主导风险变换，突出重点。
- LITE / PRO 同骨架、双密度：LITE 零金融基础可读；PRO 达到 TI 报告密度。
- 表格族 + 新图型（瀑布图、桑基图、双圈雷达、舆情波动带）。
- LLM 分析组件预留（占位实现，未来接入）。

**非目标**

- 不新增第 6 种版式（实控人风险/行业衰退等，契约无支撑字段）。
- 不改动分析引擎判定逻辑（`narrative` 由前端推导，契约仅预留字段）。
- 不动数据流管线（`getXRay` → `XrayClient`，mock 优先架构不变）。
- 不做打印样式、不做移动端断点精细化（沿用 lg 单断点 + 单列回退）。

## 3. 页面信息架构

### 3.1 骨架（两模式共享，自上而下）

```
顶栏（保留：重新扫描 / 双公司对比 / 分享 / 模式切换）
头        LITE：角色横幅        PRO：元信息条
速览层    版式驱动的图表矩阵（C 位放大）
详读层    LITE：叙事卡流        PRO：锚点导航 + section 区
页脚（保留）
```

### 3.2 头

- **LITE 角色横幅**：由 VerdictBanner + CharacterCard 融合改造——首字头像、公司名、评级徽章、一句话人话结论、HP 主血条（HealthBar 并入）、三条维度小血条、debuff 列表入口（HiddenStatusList）、小雷达图（AttributeRadar 下移）。
- **PRO 元信息条（MetaStrip，新增）**：key-value 定义列表——公司全称 / 统一社会信用代码 / 所属行业 / 成立日期 / 注册资本（万元）/ 分析基准时（asOf，沿用"锚定 fetchedAt"约定）/ 数据来源角标（ok=safe / fallback=dim / 失败=warn）；右侧小雷达图 + 健康度环（CharacterCard PRO 形态保留）。

### 3.3 速览层

- **图位 5 个**：财务 / 股权 / 诉讼 / 舆情 / 关联网络。C 位 = 主导维度图放大（占 2×2），其余 4 图按风险优先级降序排列。
- **雷达图**：非均衡版式位于头部区（小雷达）；均衡版式时升级为速览层 C 位大图，头部小雷达隐藏。
- **PRO**：5 图位全量展示。
- **LITE**：C 位大卡 + 3 张迷你卡（其余维度按优先级取前 3；被挤出维度的解读在详读层叙事卡承载）。关联网络不进 LITE 速览层。

### 3.4 详读层

**PRO —— 锚点导航（AnchorNav，scroll-spy，active 高亮）+ 七个 section：**

| 顺序 | section | 内容 |
|---|---|---|
| 1-5 | 财务详情 / 股权与质押 / 涉诉与执行 / 舆情洞察 / 关联网络 | 顺序随版式变化（主导维度排第一），见 §4.3 |
| 6 | 证据溯源 | RiskTimeline 全量 + hiddenStatus 全列表 + 证据表格化（EvidenceDrawer 保留为全局快速入口，内容同源） |
| 7 | AI 分析 | LLM 预留占位，见 §8 |

**LITE —— 叙事卡流**：每维度一张 NarrativeCard（与 PRO section 一一对应），顺序同版式优先级。无锚点导航、无表格、无坐标轴、无专业术语（反向校验见 §10）。

### 3.5 响应式

沿用 lg 单断点：`<lg` 全部单列堆叠；PRO 锚点导航退化为顶部 sticky 横向 chip 条；表格横向滚动。

## 4. 版式系统

### 4.1 五种风险叙事版式

| 版式 | 触发 | C 位 | LITE 人话锚点 | 详读层第一 section |
|---|---|---|---|---|
| 资金告急 | hp score 最低 | 现金流图 + HP 强化 | 「公司快没钱了」 | 财务详情 |
| 质押告急 | def score 最低，或质押比例 ≥ 60% 强制 | 股权图 + 质押大数字仪表 | 「老板把股票 almost 押光了」 | 股权与质押 |
| 诉讼缠身 | atk score 最低，或近 12 月诉讼 ≥ 5 件强制 | 诉讼热力图放大 + 时间轴 | 「官司一大堆」 | 涉诉与执行 |
| 舆情危机 | morale score 最低 | 舆情曲线放大 + 负面高亮 | 「骂声一片 / 人心散了」 | 舆情洞察 |
| 稳健均衡 | 四维 score 全部 ≥ 60 | 五维雷达大图 | 「各项体征平稳」 | 默认顺序 |

### 4.2 判定逻辑

`narrativeOf(xray)` 纯函数（`lib/narrative.ts`，v1 前端推导）：

1. 默认：`argmin(hp, def, atk, morale)`（score 越低越危险，沿用 `scoreColor` 阈值 <30 红 / <60 黄 / ≥60 绿）。
2. 触发器覆盖：质押比例 ≥ 60% → 强制质押告急；近 12 月诉讼 ≥ 5 件 → 强制诉讼缠身。
3. 四维全 ≥ 60 → 稳健均衡。
4. 契约预留可选增量字段 `narrative?: 'debt'|'pledge'|'lawsuit'|'sentiment'|'balanced'`，未来由分析引擎接管（存在时优先于前端推导）。

**v1 判定输入仅为 `CompanyXRay` 现有字段**：质押比例取 `def.pledgeRatio`，诉讼计数取 `timeline` 近 12 月 legal 类事件数（不依赖 §6 明细扩展，保证第一期可落地）。

### 4.3 传导规则

单一 narrative 输出驱动全部编排，保证双模式一致性：

- 速览层图位排序 + C 位放大（§3.3）
- 详读层 section 顺序 + PRO 锚点顺序（§3.4）
- LITE 叙事卡顺序
- 同一家公司两种模式共用同一版式；切换模式不改变版式。

### 4.4 渲染矩阵

5 版式 × 2 模式 = 10 条渲染路径。3 家 mock 公司（danger / warning / healthy）分别落在不同版式上，形成自然覆盖；测试矩阵 = 3 公司 × 2 模式。

## 5. 组件规格

### 5.1 新增组件

| 组件 | 位置 | 规格 |
|---|---|---|
| `MetaStrip` | PRO 头 | §3.2 字段；工商字段来自契约扩展 `registry` |
| `AnchorNav` | PRO 详读层左侧 | scroll-spy（IntersectionObserver）；顺序随版式；<lg 为 sticky chip 条 |
| `NarrativeCard` | LITE 详读层 | 图标标题 + 关键数字大字 + 一段人话（≤80 字）+「查看证据 →」开抽屉；文案源优先 `llm.sectionNotes`，fallback 模板 |
| `FinancialTable` | 财务详情 | 近 5 年 + 当年 H1：营收 / 净利 / 资产负债率 / 经营现金流；行内 Sparkline（内联 SVG，不启 ECharts 实例）；万元单位，`formatWan` 格式化 |
| `PledgeTable` | 股权与质押 | 股东 / 持股比例 / 质押占其持股 / 占总股本 / 预警状态（已爆预警线 / 逼近 / 未质押） |
| `LawsuitTable` | 涉诉与执行 | 日期 / 案由 / 身份（原告·被告） / 金额 / 状态；点击行展开折叠证据行（与 EvidenceDrawer 同源） |
| `ExecutionList` | 涉诉与执行 | 被执行 / 失信：日期 / 法院 / 金额 / 状态 |
| `SentimentEventTable` | 舆情洞察 | 日期 / 标题 / 热度 / 情感值 |
| `WaterfallChart` | 财务详情 | 营收 → 营业成本 → 期间费用 → 所得税 → 净利润（ECharts，自研封装） |
| `SankeyGraph` | 股权与质押（第三期） | 股权结构桑基，与力导向图视图切换 |
| `DualRadar` | 财务详情（行业对标小节，第三期） | 双圈雷达：公司五维 vs 行业均值（契约扩展 `industryAvg`） |
| `SentimentBand` | 舆情洞察（第三期） | 舆情波动带：tone 曲线 + 事件标注带 |
| `AiSection` | PRO 详读层末位 | LLM 预留占位卡，见 §8 |

### 5.2 现有组件去向

| 现有组件 | 去向 |
|---|---|
| VerdictBanner | 拆解升级：LITE 融入角色横幅；PRO 融入元信息条 + 评级徽章 |
| CharacterCard / HealthBar | 改造为 LITE 角色横幅（血条组并入）；PRO 健康度环形态保留至元信息条区 |
| HiddenStatusList | 角色横幅（LITE）；证据溯源 section（PRO） |
| AttributeRadar | 头部区小雷达；均衡版式为速览层 C 位大图 |
| CashFlowChart / LawsuitHeatmap / SentimentCurve | 分别进财务详情 / 涉诉与执行 / 舆情洞察 section |
| RiskTimeline | 涉诉与执行 section；诉讼缠身版式时嵌入速览层 C 位（与诉讼热力图组合呈现） |
| RelationGraph | 关联网络 section（第三期加桑基视图切换） |
| EvidenceDrawer | 保留为全局抽屉；内容同步表格化到证据溯源 section |
| ShareCard | 保留；第三期做 PRO 双主题化（现有写死 `#070B14` 问题一并修） |
| StatNumber / DataSourceBadge | 复用（元信息条 / 叙事卡 / 表格族） |

### 5.3 视觉约束（沿用第一期规格）

- PRO 禁用清单不变：无发光 / 无 blur / 无扫描线，hover 仅边框加深；LITE 保留玻璃拟态与动效。
- 严重度色全部走主题 tokens（顺手清理 `types.ts` L176-180 硬编码 `RISK_COLOR` 与 EvidenceDrawer 等处的 `text-neon` 残留）。

## 6. 数据契约扩展（`lib/types.ts` + mock）

mock 优先扩展，真实 adapter 后续补齐，前端不阻塞；金额万元、百分数、质押 amount=百分比等既有约定不变。

| 扩展项 | 字段 | 服务于 |
|---|---|---|
| `registry` | fullName / creditCode / industry / foundedAt / registeredCapital（万元） | MetaStrip |
| `financials` | 3 年 → 5 年 + 当年 H1；新增 operatingCost / expenses / incomeTax | FinancialTable / WaterfallChart |
| `shareholders[]` | name / ratio / pledgeRatio / pledgeStatus: 'safe'\|'warning'\|'breached' / isController | PledgeTable / SankeyGraph |
| `lawsuits[]` | date / cause / role: 'plaintiff'\|'defendant' / amount（万元） / status / evidence[] | LawsuitTable（timeline legal 事件保留作聚合视图） |
| `executions[]` | date / court / amount / status | ExecutionList |
| `sentimentEvents[]` | date / title / heat / tone（-10~10） | SentimentEventTable / SentimentBand |
| `industryAvg?` | 五维行业均值（score ×4 + 稳健，第三期） | DualRadar |
| `narrative?` | §4.2 枚举 | 版式系统（预留） |
| `llm?` | §8 | AiSection / NarrativeCard |

mock 的 danger 公司带全部扩展示例数据（含 llm 示例），warning / healthy 带最小集，用于空态与降级测试。

## 7. 术语字典扩展（`lib/theme/terms.ts`）

- section 名双模式化：PRO「财务详情 / 股权与质押 / 涉诉与执行 / 舆情洞察 / 关联网络 / 证据溯源 / AI 分析」；LITE 对应人话（如「钱袋子」「官司」「口碑」「关系网」等，实现时逐条定稿入字典）。
- 叙事卡标题按版式双模式化（LITE「护盾告急」等游戏化 / PRO 专业表述）。
- 既有 cardTitles 等键保留兼容，新增键不得破坏现有调用。

## 8. LLM 组件预留

**原则：数据归引擎，解读归 AI。** LLM 只生成解读文字，不生成任何数字。

```ts
type NarrativeKey = 'hp' | 'def' | 'atk' | 'morale' | 'network'

llm?: {
  summary: string                          // 全报告摘要 → PRO「AI 分析」section
  sectionNotes?: Record<NarrativeKey, string>  // 各维度解读 → NarrativeCard 文案源
  generatedAt: string                      // ISO 时间
  model: string                            // 模型标识
}
```

- 占位期：PRO「AI 分析」section 渲染占位卡（骨架 + "能力预留"标识，不打断 IA）；LITE 叙事卡走模板文案。
- 接入后：PRO 渲染结构化摘要（核心结论 / 风险聚焦 / 数据亮点 + 生成时间 + 模型标识）；LITE 叙事卡同槽位切换 AI 文案。
- mock danger 公司带示例数据，组件以最终形态开发。

## 9. 分期实施计划

**第一期 · 骨架与版式**

- `narrativeOf()` + 版式配置 + 排序工具（vitest 覆盖：argmin / 触发器边界 60%、5 件 / 平局 / 健康线 60 边界 / 契约字段优先）
- XrayClient 两层重排；MetaStrip / AnchorNav / NarrativeCard；七个 section 容器（含 AiSection 占位）
- mock 扩展 `registry` + `narrative`；`RISK_COLOR` 硬编码清理
- DOC-C FRONTEND 的"冻结布局基线"由本文档取代，同步更新

**第二期 · 表格族与瀑布图**

- 全量明细契约扩展（§6 除 narrative / llm 外）
- FinancialTable / PledgeTable / LawsuitTable（折叠证据行）/ ExecutionList / SentimentEventTable + WaterfallChart
- 空态与降级态（数据缺失 section 优雅降级，不白屏不闪烁）

**第三期 · 高级图表与打磨**

- SankeyGraph / DualRadar / SentimentBand + 网络⇄桑基视图切换
- 动效编排（section 入场 stagger 接现有 framer-motion variants）、移动端回退细节、ShareCard PRO 双主题化

## 10. 验收标准

1. 3 家 mock 公司 × 2 模式渲染正确，版式归类符合 §4.2（单测锁定）。
2. 切换模式：版式不变、骨架不变、仅密度与术语变。
3. LITE 叙事卡与界面文案零金融术语（以术语字典做反向校验测试：LITE 渲染文本不得包含 PRO 专属词表）。
4. 表格数据与 mock 一致；金额万元格式化正确；质押语义为百分比。
5. 空数据 section 优雅降级；折叠证据行与抽屉同源。
6. PRO 速览层 + 详读层 ECharts 实例按需初始化（IntersectionObserver 懒加载），首屏实例数 ≤ 6。

## 11. 风险与约束

- **DOC-C 基线替换**：旧"冻结布局"文档与本文档冲突处以本文档为准，第一期同步修订 DOC-C。
- **EChart 实例数**：详读层 7 section 若全部 eager 初始化实例过多，必须懒加载。
- **双轨 token 残留**：清理硬编码色值时以 tokens 为唯一真源，禁止新增第三处色值定义。
- **范围纪律**：第 6 版式、打印样式、移动端精细化、LLM 真实接入，均为显式排除项。

## 12. 附录 · 决策记录

| 决策点 | 选择 | 备选 |
|---|---|---|
| 重设计动机 | 页面级视觉 + IA + 图表密度 + 双受众（全选） | — |
| 自适应机制 | A 风险叙事版式（有限原型集） | B 数据存在性 / C 纯动态网格 |
| 双模式 IA | A 同骨架双密度 | B 两种 IA / C 详读层共用 |
| 图表包 | 推荐包全量（速览 5 图 + 瀑布/桑基/双圈/波动带 + 表格族） | — |
| 版式清单 | 5 种，不做第 6 种 | 实控人风险 / 行业衰退（契约无支撑） |
| 判定逻辑 | argmin + 触发器覆盖，v1 前端推导 | 分析引擎输出（预留 narrative 字段） |
| 版式传导 | 单一 narrative 驱动全部编排 | 各层独立判定 |
| LLM 组件 | 预留占位，数据归引擎解读归 AI | 接入后另立规格 |
