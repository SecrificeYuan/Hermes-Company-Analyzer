# Agent Note: 改用 Next.js 全栈应用

- Status: implemented
- Date: 2026-10-02
- Class: architecture

## Problem

初始架构使用 React/Vite 前端和 Python/FastAPI 服务端，会产生两套工程、两套运行环境和额外的跨域、类型同步与部署工作。当前目标是在 48 小时内建立三人能协作的框架，用户决定将服务端改为 Next.js。

## Decision

采用 Next.js + TypeScript 作为唯一应用工程。浏览器界面使用 Next.js 组件，服务端 API 使用 Node.js runtime 下的 Route Handlers；数据获取和数据分析保留为服务端内的独立模块，通过 `CompanySnapshot v1` 与 `AnalysisReport v1` 分隔。

原有 HTTP API 和 JSON 契约不改变，因此三模块的职责、异步任务状态及前端消费方式保持稳定。

## Alternatives considered

1. 保留 Python/FastAPI：不采用，因为用户已指定服务端技术变更，且双工程在比赛时间内增加协作和部署开销。
2. 仅将页面从 Vite 迁移到 Next.js，保留 FastAPI：不采用，因为仍保留两套部署与类型同步边界，未获得全栈框架的主要收益。
3. 将数据获取逻辑放到浏览器：不采用，因为会暴露来源访问限制，也会破坏来源留痕和统一失败处理。

## Consequences

明天开始实现时，应在 `apps/web` 初始化 Next.js 项目，并使用 TypeScript 与 Zod。Python、FastAPI、Pandas、Pydantic 不再是本项目依赖。任何要求 Edge Runtime 的部署方案都需先验证其是否支持所选的数据获取和缓存能力；首版默认 Node.js runtime。
