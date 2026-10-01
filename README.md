# Hermes Company Analyzer

Hermes Company Analyzer 是杭州银行企业赛题「X-Ray｜透视·真相」的 Hackathon 原型。用户输入一家 A 股上市公司后，系统在线收集真实公开信息，给出可追溯的财务、信用风险、经营与舆情分析。

## 当前阶段

当前仅完成需求、架构和契约骨架。业务实现将在三模块负责人领取任务后开展。

## 文档导航

1. [需求与范围](docs/需求与范围.md)：已确认的产品范围和验收目标。
2. [开发计划](docs/开发计划.md)：协作节奏、任务边界和集成关卡。
3. [总体架构](docs/总体架构.md)：技术选型、数据流和模块边界。
4. [接口契约](contracts/README.md)：HTTP API 与模块间数据模型的权威定义。
5. [协作规则](AGENTS.md)：所有协作者和 AI 开始工作前必须阅读。

## 仓库布局

```text
apps/web/       结果展示成员：Next.js 页面、Route Handlers、ECharts 组件
apps/worker/src/acquisition/    数据获取成员：公司解析、来源适配与快照生成
apps/worker/src/analysis/       数据分析成员：指标规则、Evidence Pack、LLM 与报告生成
apps/worker/src/orchestration/  数据获取成员：SQLite 作业领取与 Worker 启动
contracts/      冻结的跨模块契约
docs/           需求、架构与计划
.agents/notes/  关键决策记录
data/           本地 SQLite、缓存和原始抓取引用，不提交 Git
```

## 运行状态

技术实现尚未开始，因此当前没有可运行命令。MVP 将使用 Next.js、TypeScript 与 SQLite；不使用 Redis、BullMQ 或消息队列。实现阶段开始后，权威启动和验证命令将写入 `AGENTS.md`。
