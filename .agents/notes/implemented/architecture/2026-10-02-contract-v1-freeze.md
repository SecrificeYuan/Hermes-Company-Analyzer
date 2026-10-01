# Agent Note: 冻结协作契约 v1

- Status: implemented
- Date: 2026-10-02
- Class: process

## Problem

三位成员即将按数据获取、数据分析和结果展示并行实现。未冻结的接口形状、来源语义或 Worker 状态会让模块各自实现不兼容的假设。

## Decision

冻结 `contracts/` 的 v1：A 股候选查询、SQLite 作业状态、来源适配、企业快照、LLM 请求/结果、分析报告与图表语义成为当前协作基线。目录所有权按 `AGENTS.md` 和总体架构执行。

## Alternatives considered

1. 继续保持 DRAFT：不采用，因为会阻塞三人从夹具开始并行开发。
2. 先实现后补契约：不采用，因为数据获取、分析与展示会在联调时发生破坏性返工。

## Consequences

向后兼容的新增字段仍需更新契约和夹具。删除字段、重命名、改枚举或改变失败语义必须由三位成员确认，并升级契约版本或同步修改所有消费者。
