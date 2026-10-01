# Agent Note: SQLite 单 Worker MVP

- Status: implemented
- Date: 2026-10-02
- Class: architecture

## Problem

在线数据抓取和 LLM 调用不能阻塞 Next.js HTTP 请求，但 Redis/BullMQ 会为 48 小时单机演示增加额外服务、配置和故障点。

## Decision

采用 SQLite 作为 `analysis_jobs`、短期缓存、快照索引和报告的唯一持久化存储。单个 TypeScript Worker 轮询作业表，并用事务、`lease_expires_at`、`attempt`、`updated_at` 领取和更新作业。Route Handlers 只写入、查询 SQLite 作业和读取报告。

## Alternatives considered

1. Redis/BullMQ：不采用，因为 MVP 不需要多 Worker 或高吞吐，额外基础设施会增加演示风险。
2. 在 Route Handler 同步执行：不采用，因为网页抓取和 LLM 调用时间不可预测，会让请求超时。
3. 多 Worker 共享 SQLite：不采用，因为 SQLite 锁竞争会增加复杂度，单 Worker 足以满足演示。

## Consequences

系统不保证高并发、高可用或多实例部署。Worker 崩溃后的租约恢复只覆盖最小演示场景；复杂重试、取消和分布式调度明确延后。
