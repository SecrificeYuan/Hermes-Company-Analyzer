# 设计 · LITE 简洁化：灯先行，游戏做皮，人话做骨

> 2026-10-03。上游依据：[PRD-HACKATHON-XRAY](../PRD-HACKATHON-XRAY.md)
> （"付钱之前，先拍张 X 光"）+ 2026-10-03 grill-me 十问定稿 + brainstorming 四澄清。
> 术语沿用 [PUBLIC-COMPANY-DATA.md](../PUBLIC-COMPANY-DATA.md)，契约约定遵循
> 万元/百分数、v1.1 增量字段不破 v1 消费者等既有隐性约定。

## 背景与目标

LITE 模式面向**所有非金融普通用户**（"我妈要买理财"），当前 /report 与 /compare
首屏充斥着需要二次翻译的分析师残留：RISK SCORE 0-100、"低风险 · GREEN"、
"暂不生成健康分数"、"XX 胜 · 更健康"、K.O./双剑/败者压暗等 RPG 符号、
以及同一维度三套名字（DEF·护甲 / 护盾 / 股权质押）。

目标：**像体检报告一样好懂，像游戏一样好看**。

- 灯（红/黄/绿）升为首屏唯一结论，直接回答"这钱能付吗"
- 游戏感从符号层退到视觉层：霓虹/动效/血条/勋章保留，RPG 黑话退场
- 全页术语统一为人话词：钱袋子 / 护盾 / 麻烦 / 口碑 / 关系网
- debuff 栏补齐产品灵魂三件套：层数刻度、中文严重度、叠加致死警告
- 非上市主体照常出片（便携 X 光），消灭"暂不生成健康分数"墙
- 对比页结论改付款人语言，支持上市+非上市混合对比

PRO 模式不动（共享文件只加不改 PRO 词条）。

## 关键决策记录（已逐问获批）

| # | 决策 | 结论 |
|---|---|---|
| 1 | 首屏主角 | 灯升为主角，角色面板降级为"展开看细节" |
| 2 | 0-100 分数 | 保留（血条/勋章/分数对普通用户直观），配 LLM 人话解释语句 |
| 3 | 雷达图 | 报告页降级进面板缩小（140px）；对比页 DualRadar 保留为核心证据 |
| 4 | 术语体系 | 人话词当主标签，游戏缩写（HP/DEF/ATK）只作小字点缀；HIDDEN STATUS→隐藏状态 |
| 5 | debuff 栏 | 人话标题 + 中文严重度（高危/注意/轻微）+ 层数刻度 + ≥3 条叠加警告条 |
| 6 | 非上市分支 | 灯按可查信号亮；查得到维度照常显示、查不到明确标"没查到"；附缺口清单 |
| 7 | 对比页框架 | VS 双卡布局保留；结论"这钱付给 {name} 更稳"；标题"两家公司比比看"；PLAYER→公司 A/B |
| 8 | 对比范围 | 上市公司实时 API + 非上市人工快照，混合对比 |
| 9 | 灯字文案 | 红="先别付这钱" / 黄="能付，但换个付法"+固定附"怎么付更安全" / 绿="这钱能付" |
| 10 | RPG 符号 | 双剑加载→中性骨架屏；K.O. 删（只留 VS）；败者压暗→胜者角标"钱付这家更稳"；比分改中文"风险分" |
| 11 | 灯的契约 | 新增 `xray.light?: LightVerdict`，lib/analysis 纯函数生成 |
| 12 | 非上市定色 | 0 命中+覆盖不足→强制黄"资料不足，先别急着付"（limitedSignals）；覆盖足 0 命中→绿+角标 |
| 13 | 一屏约束 | 守住：灯区通栏置顶不滚，下方两列内滚；1366×768 兜底验收 |
| 14 | 双方诊断 | verdict 长文引述删除，换双方灯语小卡（各 headline+reason） |

## 契约变更（lib/types.ts，全部 v1.1 风格可选增量）

```ts
export interface LightVerdict {
  color: 'red' | 'yellow' | 'green'
  headline: string          // 固定三句之一（见下）
  reason: string            // 一句人话；x.llm?.lightReason 存在时优先覆写
  saferAdvice?: string      // 仅黄灯：怎么付更安全（月付/分期/先查备案）
  limitedSignals?: boolean  // 非上市"基于公开信号"诚实角标
}

export interface HiddenStatus {
  // ...既有字段不变
  tier?: { current: number; max: number }  // 层数刻度，如质押 30/60/80 → { current: 2, max: 3 }
  fatal?: boolean                           // 致命 debuff（无牌照/未备案招商），命中即红灯
}

export interface CompanyXRay {
  // ...既有字段不变
  light?: LightVerdict
  llm?: LlmSummary & { lightReason?: string }  // 灯理由的 LLM 覆写通道
}
```

灯字固定映射（`deriveLight` 唯一出口，组件不得自造）：

| color | headline |
|---|---|
| red | 先别付这钱 |
| yellow | 能付，但换个付法 |
| green | 这钱能付 |

黄灯且 `saferAdvice` 缺失时，渲染层不得显示"怎么付更安全"区块（宁可没有，不编）。

## 纯函数层（新 lib/analysis/light.ts）

```ts
deriveLight(input: {
  overallRisk: RiskLevel
  hiddenStatus: HiddenStatus[]
  coverage: 'full' | 'partial' | 'insufficient'   // 关键切片覆盖度
}): LightVerdict
```

判定表（基准档 + 修饰，顺序自上而下）：

| 步骤 | 条件 | 效果 |
|---|---|---|
| 基准 | `overallRisk` 映射 | green→"这钱能付" / yellow→"能付，但换个付法" / red→"先别付这钱"（与 PRD"阈值与 overallRisk 三档语义对齐"一致） |
| 修饰 1 | 任一 `fatal` debuff 命中 | 直接 red（PRD"致命任一命中即红灯"） |
| 修饰 2 | 非 fatal debuff 数 ≥ 3 | 升一档：green→yellow、yellow→red、red 不变（PRD"叠加致死"） |
| 修饰 3 | coverage ≠ 'full' 且当前为 green | 压到 yellow 并置 `limitedSignals: true`——"没查到"不得渲染成"干净" |

黄灯均附 `saferAdvice`（1–2 条命中来自信号引擎；覆盖不足时为"先小额/月付试试"）。
`reason` 模板由最强信号（fatal 优先，其次 severity）的人话描述拼装，禁止包含
`LITE_BANNED_TERMS` 词汇。`analyze()`（上市）与 `healthToXray()`（非上市）各调用一次；
coverage：上市恒 'full'，非上市按 `CompanyHealth.overall`（partial/insufficient）映射。

### 信号引擎 tier 输出

五条既有 debuff 规则在 `HiddenStatus` 上补 `tier`：质押穿透按 pledgeRatio 三档
（<40%→1/3，40–69%→2/3，≥70%→3/3），其余规则按各自定义决定（无明确档位的规则不输出 tier）。
新增品类弹药规则（加盟未备案/理财无牌照等，PRD 信号引擎扩展范围）输出 `fatal: true` 与各自 tier。
**本设计只消费 tier/fatal，不改写规则判定逻辑本身。**

## 报告页 LITE 版式（守一屏）

```
┌──────────────────────────────────────────────────────┐
│ 顶栏：← 重新扫描        双公司对比 · 分享              │
├──────────────────────────────────────────────────────┤
│ LightBanner 通栏（不滚动）：                            │
│   ● 大字 headline ｜ reason 一句 ｜ [查看证据]         │
│   黄灯时第二行：怎么付更安全 → saferAdvice             │
├──────────────────────┬───────────────────────────────┤
│ 左列（内滚）           │ 右列（内滚）                    │
│  身份行：名/行业/代码   │  ≥3 条时：⚠ 多重负面状态叠加     │
│  + 风险分小字          │  ────────────────              │
│  钱袋子（血条 /100）   │  debuff 卡 ×N：                 │
│  护盾 · 质押 行        │   人话标题（高危/注意/轻微）       │
│  麻烦 · 官司 行        │   层数刻度 ▮▮▮▯ 3/4            │
│  口碑 行              │   描述两行 + 点击开证据抽屉       │
│  小雷达 140px         │  ────────────────              │
│  数据来源角标          │  5 张紧凑叙事卡（钱袋子/护盾/     │
│                      │  麻烦/口碑/关系网）               │
├──────────────────────┴───────────────────────────────┤
│ footer：所有结论均可点开证据溯源 · 不构成投资建议        │
└──────────────────────────────────────────────────────┘
h-[calc(100vh-2.25rem)]，灯区+顶栏+footer 不滚，两列各自 overflow-y-auto
```

- **徽章"低风险 · GREEN"删除**（灯取代）；RISK SCORE 数字保留小字（决策 #2）
- 维度条标签：护盾 · 质押 / 麻烦 · 官司 / 口碑；数值行文案去英文
- HealthBar 底部"资产负债率"字样违反禁用词表，改"欠债是资产的 {debtRatio}%"
- 雷达从 Hero 右栏移入左列底部，高度 140px；1366×768 下允许折叠为"看看五维体征"展开条

### 组件改造

| 组件 | 动作 |
|---|---|
| `LightBanner.tsx` | 新建：灯圆点+headline+reason+saferAdvice+证据入口（点击开 EvidenceDrawer，证据取最强 debuff） |
| `CharacterCard.tsx` | 拆为 `CharacterPanel.tsx`：删徽章行/verdict 段/ADVICE 行（全部移交 LightBanner）；雷达缩 140px 移左列；健康度待评估徽章与"暂不生成健康分数"墙删除 |
| `HiddenStatusList.tsx` | 层数刻度条、中文严重度映射（high→高危/mid→注意/low→轻微）、≥3 叠加警告条置顶、severity 排序保持 |
| `XrayClient.tsx` | LITE 布局重排：灯区置顶通栏 + 两列内滚网格；非上市（health）分支逐块渲染 |
| `NarrativeCard.tsx` | 文案消费不变；caption"舆论温度"改"口碑温度" |
| `terms.ts` | LITE 表整表重写（见下）；PRO 表不动 |

### 非上市分支（health 存在时）逐块渲染

面板各块按切片有无渲染，缺失块占位文案统一为"**这块没查到——没查到不等于没问题**"：
钱袋子块（years/OCF 有则显示）、护盾块（pledgeRatio）、麻烦块（lawsuitAnnouncements）、
口碑块（恒缺，直接占位）。面板底部列缺口清单（`health.gaps`）+ 来源状态。
灯由 `deriveLight` 按基准档+覆盖度修饰生成（绿色基准在覆盖不足时压黄，见判定表修饰 3）。

## 对比页改造

| 部位 | 现状 | 改为 |
|---|---|---|
| 标题 | 双公司对战 | 两家公司比比看 |
| 槽位 | PLAYER 1/2 | 公司 A / 公司 B |
| 按钮 | 开战 / Swords 图标 | 开始对比 / GitCompareArrows（双模式同图标） |
| 加载 | BattleLoading 双剑交锋 | 双卡骨架屏（shimmer）+ "正在生成两份体检报告…" |
| 结果徽章 | K.O. / VS 切换 | 只留 VS |
| 胜者表达 | 败者卡压暗+降亮度 | 压暗删除；胜者卡右上角角标"钱付这家更稳" |
| 结论横幅 | {name} 胜 · 更健康 + RISK x:y | 这钱付给 {name} 更稳 · 风险分 68 : 41（平局：两家差不多） |
| 双方诊断 | verdict 长文 blockquote | 双方灯语小卡：各 headline+reason 一行 |
| 快照主体 | 仅上市公司搜索 | 槽位加"演示名单"入口：下拉列出快照主体（名称+身份标签），选中走 slug 路由；主体名单本期为 `lib/data/snapshot-subjects.ts` 内联常量，信号引擎快照落地后替换为同一注册表 |
| API | /api/company/[id]/xray 仅 6 位代码 | 兼容快照 slug：非 6 位 id 走 findCompany+healthToXray（同报告页逻辑） |

双方灯语卡数据来自各自的 `xray.light`；`light` 缺席（旧数据）时回退
`headline` 由 overallRisk 映射、reason 用 verdict 首句截断，保证不崩。

## terms.ts LITE 新词表（PRO 不动）

```ts
healthLabel: '钱袋子'
defLabel: '护盾 · 质押'
atkLabel: '麻烦 · 官司'
moraleLabel: '口碑'
hiddenTitle: '隐藏状态'
riskScoreCaption: '风险分'
radarIndicators: ['血量', '护盾', '麻烦', '口碑', '稳健']
radarSeriesName: '五维体征'
cardTitles.radar: '五维体征'
sections: { financial: '钱袋子', equity: '护盾', legal: '麻烦', sentiment: '口碑', network: '关系网', evidence: '证据与来源', ai: '智能解读' }
dimensionTitles: { hp: '钱袋子', def: '护盾', atk: '麻烦', morale: '口碑', network: '关系网' }  // 不变
narrativeTitles: 不变（血量告急/护盾告急/麻烦缠身/人心浮动/体征平稳）
compare: {
  title: '两家公司比比看', action: '开始对比', actionLoading: '分析中…',
  winnerTemplate: '这钱付给 {name} 更稳', drawLabel: '两家差不多',
  idleHint: '选两家公司，看看钱付给谁更稳', slotLabel: '公司 {slot}',
  verdictQuoteTitle: '两边各一句', /* copyLink/copied/retry/sameCompanyHint 不变 */
}
```

游戏缩写（HP/DEF/ATK）允许以 icon 旁小字、css 装饰形式出现，不进主文案。

## 错误处理与降级

| 场景 | 行为 |
|---|---|
| `light` 字段缺席（旧 mock/降级数据） | 渲染层 fallback：headline 由 overallRisk 映射（red→先别付这钱，yellow→能付，但换个付法，green→这钱能付），reason 取 verdict 首句；不崩、不白屏 |
| LLM 未配置 | reason 走模板；`llm.lightReason` 缺席即模板，无感知降级 |
| 切片 `available: false` | 维持现有"暂无法判断/待加载"卡，语义不变（不把占位当结论） |
| 非上市切片缺失 | 分块占位文案 + gaps 清单；灯按判定表第 4/5 行，绝不绿灯裸奔 |
| 黄灯 saferAdvice 缺失 | 不渲染"怎么付更安全"区块（宁缺毋编） |

## 测试策略

- **deriveLight 单测**（新 `lib/analysis/__tests__/light.test.ts`）：五路径 fixture 矩阵
  （fatal→红；≥3 叠加→红；1–2→黄带 advice；0 命中 full→绿；0 命中 partial→黄 limitedSignals），
  上市 mock-healthy/warning/danger 三档回归必须过
- **tier 输出断言**：质押三档 fixture 断言 `tier.current/max`；无档位规则断言 tier 缺席
- **灯语快照测试**：无 LLM 模板路径 headline+reason 快照；`light.reason` 与
  `llm.lightReason` 渲染文案跑 `LITE_BANNED_TERMS` 反向校验（扩展既有测试）
- **terms/narrative-copy 既有测试**更新至新词表
- **验收**：`npm run typecheck && npm run test && npm run build`；三档 curl 复测；
  dev server 截图验收 1920×1080 与 1366×768 两档（遵循项目 dev 验证五坑：先重启、
  查原始字节、禁运行中 build）

## 分期

| 期 | 内容 | 出口 |
|---|---|---|
| P1 契约+引擎 | types 增量、deriveLight、五规则 tier、全部新单测 | typecheck+test 绿，无 UI 改动 |
| P2 词表+报告页 | terms 重写、LightBanner、CharacterPanel 拆分、HiddenStatus 升级、XrayClient 版式、HealthBar 文案 | 1080p 截图验收 |
| P3 非上市+对比页 | healthToXray 接 deriveLight、逐块渲染、CompareSelector 快照入口、xray API slug、对比页全套措辞/骨架屏/角标/灯语卡 | 混合对比通 |
| P4 验收 | 三档 curl、1366×768 兜底截图、banned terms、build | 全绿 |

## Out of Scope

- 新信号规则（品类弹药/通用红灯）的判定逻辑本身——PRD 信号引擎扩展另案，本设计只消费其输出
- LLM 接入工程——仅留 `llm.lightReason` 覆写通道，管线沿用 PRD 对话管线设计
- PRO 模式任何版式/文案改动
- 首页、对话模式、分享卡
