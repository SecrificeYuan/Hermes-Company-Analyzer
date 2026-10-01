# Agent Note: Worker、异构数据源与受约束 LLM 管道

- Status: implemented
- Date: 2026-10-02
- Class: architecture

## Problem

项目需要在线处理官方 API、网页、开源采集工具和社交平台等异构来源，并使用 LLM 生成解释。将这些耗时且不可信输入处理步骤直接放在 Next.js Route Handler 中，会受到 HTTP 生命周期限制，难以表达分阶段进度，也会让来源失败或模型限流影响用户请求。

## Decision

保留 Next.js 作为页面和 HTTP API 层，新增同一 TypeScript 项目内的单个 Node.js Worker。Route Handler 负责将查询作业写入 SQLite，Worker 通过事务轮询并领取任务，依次执行来源适配、规范化、确定性规则分析和可选 LLM 叙述。

所有来源通过 `DataSourceAdapter` 产生 `SourceFetchResult`，再由采集编排器生成 `CompanySnapshot v1`。LLM 只能消费 Evidence Pack，并产生带 `evidenceIds` 的段落；输出校验失败或模型不可用时，报告回退至确定性模板。分析层生成 `VisualizationSpec`，前端负责 Apache ECharts 的视觉实现。

## Alternatives considered

1. 在 Route Handler 内同步运行抓取和 LLM：不采用，因为长请求容易超时，无法可靠展示阶段进度和部分失败。
2. 为每个数据来源独立部署服务：不采用，因为 48 小时内会增加部署、认证和联调复杂度；适配器接口已经提供替换能力。
3. 让 LLM 直接读取网页或决定评分：不采用，因为会引入提示注入、来源幻觉和不可解释结论。
4. 后端直接返回 ECharts 配置：不采用，因为会把视觉主题与金融分析规则绑定，使图表迭代影响分析模块。

## Consequences

演示环境只需要运行 Next.js 与单个 Worker；SQLite 保存作业、缓存和报告。明天数据获取负责人首先实现适配器 Manifest、SQLite 作业领取和一个核心官方来源；数据分析负责人首先实现规则报告和 Evidence Pack；结果呈现负责人以 `VisualizationSpec` 和契约夹具开发页面。图表库和 LLM Provider 的具体版本在实现任务开始时登记。
