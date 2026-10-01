# Hermes v1 接口契约

本目录是数据获取、数据分析和结果呈现三个模块之间的唯一契约来源。当前版本为 **v1，已冻结**。

## 文件与所有权

| 文件 | 用途 | 所有者 | 消费者 |
|---|---|---|---|
| `openapi.yaml` | 浏览器和 API 之间的 HTTP 契约 | API 任务编排负责人 | 结果呈现负责人 |
| `company-snapshot.v1.schema.json` | 数据获取到数据分析的标准化企业快照 | 数据获取负责人 | 数据分析负责人 |
| `source-fetch-result.v1.schema.json` | 任意数据源适配器到采集编排器的输出 | 数据获取负责人 | 数据获取负责人 |
| `llm-narrative-request.v1.schema.json` | Evidence Pack 到 LLM 叙述层的输入 | 数据分析负责人 | LLM 适配器 |
| `llm-narrative-result.v1.schema.json` | LLM 叙述层的输出 | 数据分析负责人 | 结果呈现负责人 |
| `visualization-spec.v1.schema.json` | 分析层到前端的图表语义 | 数据分析负责人 | 结果呈现负责人 |
| `数据源适配器契约.md` | 数据源插件协议、来源可信度与合规边界 | 数据获取负责人 | 所有模块 |
| `LLM与可视化契约.md` | LLM 防幻觉规则与图表责任边界 | 数据分析负责人 | 数据分析、结果呈现负责人 |
| `fixtures/` | 契约测试与 UI 开发用的虚构样例 | 契约维护者 | 所有模块 |

`fixtures/` 只能用于开发和测试，不能在用户查询时作为真实企业结果返回。

冻结后任何破坏性变更都必须按本文末的变更流程执行。

## 端到端调用流程

1. 结果呈现先调用 `GET /v1/company-candidates`；用户在同名候选中确认 A 股企业。
2. 结果呈现调用 `POST /v1/analysis-jobs`，提交已确认的企业身份；Route Handler 只将作业写入 SQLite。
3. 单个 Worker 轮询 SQLite 并以事务领取作业，依次执行 `resolving`、`fetching`、`normalizing`、`analyzing` 与可选的 `generating_narrative` 阶段。
4. 前端按 `pollAfterMs` 查询 `AnalysisJob`；任务进入 `succeeded` 或 `partial` 时，`analysisId` 必定存在，前端据此读取 `AnalysisReport`。
5. `partial` 表示至少有可展示的真实数据和报告，但一个或多个维度、数据源或 LLM 叙述获取失败或不足；前端必须展示 `coverage` 与 `errors`。
6. `failed` 表示没有可安全展示的报告；前端显示错误信息，并允许重新查询。

## 公共 HTTP 契约

HTTP 字段、状态码和枚举以 [openapi.yaml](openapi.yaml) 为准。核心资源如下：

| 资源 | 说明 |
|---|---|
| `AnalysisJob` | 一次在线查询任务的状态、进度、失败或部分成功信息 |
| `AnalysisReport` | 面向展示层的已分析企业报告 |
| `TimelineEvent` | 报告中可排序展示的公告、风险或新闻事件 |
| `Evidence` | 可追溯的来源记录，包括来源类型、适配器、URL、获取时间、提取方式和可信度 |

## 内部 `CompanySnapshot v1` 契约

数据获取模块必须输出符合 [company-snapshot.v1.schema.json](company-snapshot.v1.schema.json) 的对象。数据分析模块只能读取该对象，不得依赖爬虫私有字段或原始 HTTP 响应。

| 字段 | 含义 | 规则 |
|---|---|---|
| `company` | 已解析的 A 股企业身份 | `stockCode` 是六位数字，`market` 为 `A_SHARE` |
| `financialSeries` | 归一化的财务时间序列 | 每个点带报告期、数值、单位和 `evidenceIds` |
| `events` | 风险、公告、新闻或社交观察 | 不根据缺失推断“无事件”；社交观察须标记为观点而非事实 |
| `evidence` | 所有事实与观察的来源记录 | URL、来源名称、获取时间、来源类型、适配器和可信度为必填 |
| `coverage` | 各数据维度的覆盖状态 | `unavailable` 必须有原因 |

## 状态与错误语义

| 状态/枚举 | 语义 | 消费方必须如何处理 |
|---|---|---|
| `complete` | 该维度所需数据已取得并通过基本校验 | 正常展示 |
| `partial` | 有部分可用数据，结论范围受限 | 展示可用部分和缺失说明 |
| `unavailable` | 该维度没有可用数据 | 不生成该维度风险判断 |
| `unknown` 风险等级 | 证据不足，无法判断 | 不能映射成低风险或绿色 |
| `low` / `medium` / `high` | 规则评估出的风险级别 | 同时展示信号和证据 |
| `failed` 任务 | 没有可安全展示的完整或部分报告 | 只展示错误和重试入口 |
| `fallback` LLM 叙述 | LLM 不可用或输出校验失败，使用规则模板 | 正常展示模板化结论，并提示叙述未由 LLM 生成 |

## 不变式

1. 所有 `Signal` 必须引用至少一个 `evidenceId`；数据不足信号引用相应的覆盖状态或失败原因。
2. 所有派生财务指标都需要 `formula`，并引用输入数据证据。
3. 前端不得用字段缺失推断低风险、零值或不存在事件。
4. 分析模块不得因为某一来源获取失败而自行构造替代事实。
5. API 响应中不返回密钥、Cookie、原始反爬响应或内部异常堆栈。
6. 社交平台内容只能作为 `opinion` 或 `reputation` 观察；它不能单独改变财务数值、信用事实或最终风险等级。
7. LLM 输出的每个段落必须引用 Evidence Pack 中存在的 `evidenceId`；引用校验失败时不得返回该段落。
8. `exchange_announcement` 是适配器层分类；规范化为快照和报告时间线时映射为 `announcement`。`reputation` 在来源、证据和时间线三层均保留。
9. `llm_assisted` 提取必须提供 `extractionConfidence` 和 `verificationStatus`；未验证、拒绝或冲突的数据不得参与量化与风险等级。
10. 本项目为单机 MVP：SQLite 是作业、缓存、快照索引和报告的唯一持久化存储；不使用 Redis、BullMQ 或消息队列。

## 契约变更流程

- 增加可选字段：在 PR/提交说明中标记为向后兼容，并更新 Schema、OpenAPI 和夹具。
- 删除字段、重命名字段、修改枚举或失败语义：先由三位模块负责人确认；创建 `v2`，或同一次变更更新所有消费者。
- 未冻结前的讨论可以改 `contracts/`；冻结后不得为了局部实现方便而静默修改。
