# Hermes · 公司 X 光机

首页支持上市与未上市企业搜索，以及 Lite / Pro 条件筛选。查询时从公开网页与企业披露中发现主体，再根据可核实的财务指标评估健康状况；不使用固定企业候选池。

## 本地运行

```bash
npm install
npm run dev -- --hostname 127.0.0.1
```

打开 http://127.0.0.1:3000 。搜索支持公司名、统一社会信用代码与六位证券代码；同名结果需要核对来源与地区。条件筛选最多返回 3 家满足已验证条件的企业，并单独列出资料不足的线索。

未上市企业和境外主体的公开资料覆盖不保证完整。筛选按输入条件实时查询外部来源；当前匿名来源不是完整工商名录。Wikidata 只提供协作数据线索，企业主体和信用代码仍需工商登记核验。未取得财报、司法记录或交易条款时保留未知。未上市不等于无证券代码，发行阶段企业会单独判断。回报率不会从健康评分直接换算，预算不会按股票每手金额估算。

当前无需企业数据 API 密钥。网页读取尊重来源访问限制，不处理登录或验证码。新发现的企业通过可重建的公开来源 ID 打开报告，不写入本地企业候选库；旧版 `web_` 链接仅保留只读兼容。数据服务或页面结构变更可能导致查询降级，报告会显示来源状态。

```bash
npm run typecheck
npm run test
npm run build
```

新流程与接口详见 [公开企业数据说明](docs/PUBLIC-COMPANY-DATA.md)。下方保留原始演示引擎及团队协作说明；首页报告不使用其缺省评分。

## 三层架构

```text
┌─ Data Layer  lib/data/ ─────────────────────────────┐
│  adapters: akshare / cninfo / juhe / gdelt / mock   │
│  fetcher.ts: 并行调度 + 切片级降级 + sources 诚实标记 │
│  产出: RawCompanyData                                │
└──────────────────┬───────────────────────────────────┘
                   ▼
┌─ Analysis Layer  lib/analysis/ ─────────────────────┐
│  scoring: hp / defense / attack / morale（各 0-100） │
│  debuff:  隐藏状态规则引擎（无证据不触发）             │
│  timeline / graph / verdict / analyze.ts 主入口      │
│  产出: CompanyXRay        （纯函数，无网络依赖）       │
└──────────────────┬───────────────────────────────────┘
                   ▼
┌─ Presentation Layer  app/ + components/ ────────────┐
│  首页扫描 → 报告页 X 光片 → 对比页                    │
│  只消费 CompanyXRay，绝不触碰 RawCompanyData          │
│  统一出参: GET /api/company/[id]/xray                │
└──────────────────────────────────────────────────────┘
```

**契约唯一真源：[lib/types.ts](lib/types.ts)** —— `RawCompanyData` 与 `CompanyXRay` 两个接口是三人并行的边界，修改需三人确认并同步三份 docs。

## 三人分工（分支 README 即开发文档）

| 分支 | 负责人 | 领地 | 文档 |
|---|---|---|---|
| `feat/data-engine` | 数据引擎 | `lib/data/` `data/` `scripts/` | [docs/DOC-A-DATA-ENGINE.md](docs/DOC-A-DATA-ENGINE.md) |
| `feat/analysis-engine` | 分析引擎 | `lib/analysis/` | [docs/DOC-B-ANALYSIS-ENGINE.md](docs/DOC-B-ANALYSIS-ENGINE.md) |
| `feat/frontend-xray` | 前端渲染 | `app/` `components/` `lib/theme/` | [docs/DOC-C-FRONTEND.md](docs/DOC-C-FRONTEND.md) |

**当前状态：骨架已端到端跑通**（`main` 分支含全部基线实现）。三位负责人在各自分支上按文档中的 P0→P3 任务迭代，共享文件改动前先在群里打招呼。

### 协作纪律

1. 从 `main` 切各自功能分支，只改自己领地的目录；
2. `lib/types.ts` / `lib/analysis/analyze.ts` 的 riskScore 公式 / 设计 token 属于**冻结区**，改动需三人确认；
3. 契约变更流程：群里发 diff → 改 types.ts → 同步三份 docs → 各自 rebase；
4. 合并前跑 `npm run typecheck && npm run build`，并用三家 mock 回归绿/黄/红（命令见 DOC-B）。

## 目录树

```text
├── app/
│   ├── page.tsx                    # 首页：搜索 + 扫描动画
│   ├── report/[id]/page.tsx        # X光片报告页（+ loading/not-found）
│   ├── compare/page.tsx            # 双公司对比
│   ├── api/company/[id]/xray/      # 统一出参接口
│   └── api/raw/[id]/               # 实时原始数据接口
├── components/
│   ├── scan/        ScanBeam / ScanProgress
│   ├── xray/        CharacterCard·HealthBar·AttributeRadar·HiddenStatusList
│   │                EvidenceDrawer·RiskTimeline·RelationGraph·CashFlowChart
│   │                LawsuitHeatmap·SentimentCurve·VerdictBanner·EChart(封装)
│   ├── share/       ShareCard（PNG 导出）
│   └── ui/          shadcn/ui 基础件
├── lib/
│   ├── types.ts     ★ 契约唯一真源
│   ├── data/        【A】数据源引擎（adapter ×5 · fetcher · cache）
│   ├── analysis/    【B】分析引擎（scoring · debuff · timeline · graph · verdict）
│   ├── theme/       设计 token + ECharts 暗色基底
│   └── get-xray.ts  服务端统一取数入口
├── data/mock/       3 家公司 mock（green/yellow/red）
├── scripts/         prefetch-akshare.py 离线预跑
└── docs/            DOC-A / DOC-B / DOC-C
```

## 演示预案

- **断网兜底**：mock 数据内置，拔网线照样全场演示；
- **现场输入尴尬**：首页提供 3 个预设公司卡片，点击即扫；
- **未知公司**：返回 404 引导页，不编造数据；
- **诚实加分**：报告页 VerdictBanner 展示每个数据源的成功/降级状态角标；
- 建议提前录一份 60 秒兜底视频（首页 → 扫描 → 三家公司报告连播）。

## 常见问题

| 问题 | 处理 |
|---|---|
| `npm install` peer 冲突 | 不应出现（ECharts 封装为自研，无 echarts-for-react 依赖）；如换源后出现，用 `--legacy-peer-deps` |
| 真实数据源怎么用 | 见 DOC-A：GDELT 改 `.env` 开关即用；AKShare 走离线预跑脚本 |
| 端口被占 | `npx next dev -p 3100` |
| 中文/等宽字体 | 使用系统字体栈（PingFang/雅黑 + ui-monospace），离线无忧；可后续换本地托管的 Inter/JetBrains Mono |

---

*数据仅供演示，不构成投资建议。三家预设公司均为虚构。*
