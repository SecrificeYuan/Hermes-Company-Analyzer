# DOC-B · 公司分析引擎（分支 `feat/analysis-engine`）

> 2026-10-02 更新：首页搜索、条件筛选与 `/report/[id]` 已切换为公开企业健康评估流程，
> 新契约为 `lib/company.ts` 的 `CompanyIdentity` / `CompanyHealth`；旧 `CompanyXRay` 用于原有对比接口。
> 数据来源、匹配语义与覆盖限制以 [PUBLIC-COMPANY-DATA.md](PUBLIC-COMPANY-DATA.md) 为准。


> **你的职责：** 把 `RawCompanyData` 变成 `CompanyXRay`。你是产品的"大脑"——所有游戏化结论都出自你的函数。
> **铁律：** `lib/analysis` 是**纯函数层**，不 import 任何网络/fs 模块；输入输出只认 [lib/types.ts](../lib/types.ts)。

---

## 1. 现状基线（已完成，3 家 mock 已产出 green/yellow/red）

| 文件 | 状态 | 说明 |
|---|---|---|
| `analysis/scoring/hp.ts` | ✅ 基线 | HP = 现金流 0.4 + 流动比率 0.3 + 负债率倒数 0.3；现金流为负扣 40 |
| `analysis/scoring/defense.ts` | ✅ 基线 | DEF = 100 - 质押×0.7 - 高负债惩罚（>70% 部分 ×1.5） |
| `analysis/scoring/attack.ts` | ✅ 基线 | ATK = 诉讼数×5 + 被执行额 log10 缩放，封顶 100 |
| `analysis/scoring/morale.ts` | ✅ 基线 | 近 90 天 tone 均值映射 0-100；输出 12 个月 trend |
| `analysis/debuff/rules.ts` | ✅ 基线 | 5 条规则全实现：老板套现/质押穿透/诉讼风暴/供应商反水/欠薪疑云 |
| `analysis/debuff/detectors.ts` | ✅ 基线 | 可复用探测器（recentLawsuits/cashoutEvents/…） |
| `analysis/timeline.ts` | ✅ 基线 | 四类事件合并，近 12 个月倒序 |
| `analysis/graph.ts` | ✅ 基线 | 公司为中心的一度关系网 |
| `analysis/verdict.ts` | ✅ 基线 | 模板诊断；LLM hook 仅留了注释位 |
| `analysis/analyze.ts` | ✅ 冻结 | 主入口与 riskScore 公式；改动需三人确认 |

**当前 mock 验证结果（改动算法后必须复测不劣化）：**

| 公司 | overallRisk | riskScore | hp | def | atk | morale | debuffs |
|---|---|---|---|---|---|---|---|
| mock-healthy | green | 11 | 88 | 100 | 5 | 77 | （无） |
| mock-warning | yellow | 51 | 51 | 69 | 15 | 45 | boss-cashout |
| mock-danger | red | 100 | 0 | 22 | 91 | 10 | 全部 5 条 |

**复测命令：**
```bash
npm run dev
for id in mock-healthy mock-warning mock-danger; do
  curl -s http://localhost:3000/api/company/$id/xray | jq '{r:.overallRisk,s:.riskScore,d:[.hiddenStatus[].id]}'
done
```

## 2. 你的任务清单（按优先级）

### P0 · 打分曲线调优（演示观感的决定性工作）
- 权重/阈值写在各 `scoring/*.ts` 顶部，目前是"拍脑袋基线"；
- 目标：**同行业内分数有区分度**——补 1-2 家同行业 mock 后，分数不能挤在一起；
- 可引入分位数归一化（如负债率相对行业分布打分），但必须保持纯函数（行业分布表作为常量内置）。

### P1 · 规则引擎扩军
新增规则 = 往 `RULES` 数组加一项。候选：
- `dishonest-list` 失信被执行（`legal.dishonest > 0`）——数据已备好，写了就触发；
- `audit-qualify` 审计保留意见（公告/舆情关键词）；
- `executive-exodus` 高管离职潮（180 天内离职 ≥2）；
- `query-letter` 交易所问询（announcements 类型命中）。
**底线：没有 evidence 就不触发。** 每条 evidence 必须能追溯到 raw 数据的具体条目。

### P2 · verdict 润色（LLM hook，可选）
- 在 `verdict.ts` 预留位置接入 LLM：输入 = 模板 verdict + 全部 hiddenStatus 证据；输出 = 更生动的 2 句话；
- **硬约束：LLM 不得改变分数与结论，失败/超时必须回退模板；**
- 不做 LLM 也能交付 —— 模板版已足够演示。

### P3 · 图谱增强
当前只从 people/legal/sentiment 反推节点。数据引擎接入股东数据后，扩展多层股权穿透（nodes 加 `layer` 概念，前端无需改契约）。

## 3. riskScore 公式（冻结，改动需三人确认）

```text
composite = hp×0.35 + def×0.25 + (100-atk)×0.15 + morale×0.25
riskScore = clamp(100 - composite + debuffPenalty, 0, 100)
debuffPenalty = min(20, Σ high:10 / mid:5 / low:2)
overallRisk: <35 green | 35-65 yellow | ≥65 red
```

## 4. 关键语义约定（与前端/数据引擎的接口）

1. **`asOf` 锚点**：所有"近 N 天"窗口默认锚定 `meta.fetchedAt` 而非真实当下——保证 mock 演示可复现；生产环境 `analyze(raw, new Date())`；
2. **ATK 是风险语义**：分高 = 战火旺，前端雷达图按原值绘制，不要"纠正"它；
3. **trend 数组**：`hp.trend` = 各年经营现金流（万元，可能为负，前端据此变红）；`morale.trend` = 月均 tone（-10~10）；`labels` 为 v1.1 可选增量字段；
4. **时间轴去噪**：舆情只收录 `|tone|>=4` 的显著转折点；
5. 时间轴统一**倒序**（最新在前）。

## 5. 验收标准（联调关卡）

- [ ] 3 份 mock 分别产出 green/yellow/red，且与上表基线不劣化；
- [ ] 每条 hiddenStatus 点开至少 2 条 evidence（danger 公司 5 条全触发）；
- [ ] timeline 覆盖近 12 个月、倒序、含四类 category；
- [ ] `analyze` 单测：空 legal/空 sentiment/空 financial 输入不抛异常，返回"数据不足"标签；
- [ ] （可选）verdict LLM 版在断网时回退模板无异常。

## 6. 给 Agent 的提示词（可直接粘贴）

> 实现 lib/analysis，纯函数式，输入 RawCompanyData 输出 CompanyXRay，不依赖任何网络与 fs。规则引擎用可扩展数组配置，每条规则必须产出 evidence，无证据不触发。verdict 先用模板，预留 LLM hook 且必须可回退。改完跑 3 家 mock 验证 green/yellow/red 与基线表一致。

## 7. 扩展路线（黑客松之后）

- 行业分位打分表（从 AKShare 批量预跑生成常量）；
- 规则引擎支持权重学习与 A/B 口径对比；
- 时间轴事件去重（同一诉讼在公告+司法两边出现时合并）。
