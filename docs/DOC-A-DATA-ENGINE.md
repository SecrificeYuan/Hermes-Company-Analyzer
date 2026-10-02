# DOC-A · 数据源引擎（分支 `feat/data-engine`）

> **你的职责：** 把外部世界的数据变成 `RawCompanyData`。你是整条流水线的上游，产出质量决定分析引擎的上限。
> **你唯一需要遵守的契约：** [lib/types.ts](../lib/types.ts) 中的 `RawCompanyData`。**绝不**产出 `CompanyXRay`，那是分析引擎的事。

---

## 1. 现状基线（已完成，可直接跑）

| 文件 | 状态 | 说明 |
|---|---|---|
| `lib/data/adapter.ts` | ✅ 冻结 | 适配器统一签名 `DataAdapter`，返回 `Partial<RawCompanyData> \| null` |
| `lib/data/adapters/mock.ts` | ✅ 完成 | 3 家 mock 公司注册表，断网演示的生命线 |
| `lib/data/fetcher.ts` | ✅ 完成 | 统一调度：`Promise.allSettled` + 切片级降级 + `meta.sources` 如实标记 |
| `lib/data/cache.ts` | ✅ 完成 | 进程内 TTL 缓存（5 分钟） |
| `lib/data/adapters/akshare.ts` | 🔶 骨架 | 已实现"读离线 JSON"；离线生成脚本待你补完 |
| `lib/data/adapters/cninfo.ts` | 🔶 骨架 | 标题分类器已完成；真实抓取待你实现 |
| `lib/data/adapters/juhe.ts` | 🔶 骨架 | 等 key 接入 |
| `lib/data/adapters/gdelt.ts` | 🔶 半成品 | 真实 API 调用已写好，`GDELT_ENABLED=true` 即可联调；tone 提取待打磨 |
| `scripts/prefetch-akshare.py` | 🔶 骨架 | 字段映射 TODO 待补 |
| `data/mock/*.json` | ✅ 冻结 | 3 份 mock（green/yellow/red 各一），改字段需走契约变更 |

**冒烟命令：**
```bash
npm run dev
curl http://localhost:3000/api/company/mock-danger/xray | jq '.sources'
```

## 2. 你的任务清单（按优先级）

### P0 · 跑通一个真实数据源（建议 GDELT）
1. `.env` 写入 `GDELT_ENABLED=true`，重启后请求 `/api/company/mock-warning/xray`；
2. 观察 `sources` 中 `gdelt.ok` 是否变为 `true`、舆情是否被真实数据覆盖；
3. 打磨 `gdelt.ts`：中文公司名查询词构造、按月聚合（每月一条 tone 均值 + 代表标题）、`AbortSignal.timeout` 超时控制。

### P1 · AKShare 离线管线
1. 补完 `scripts/prefetch-akshare.py` 的字段映射（注意**元 → 万元**换算）；
2. 对 1-2 家真实 A 股公司预跑，产出 `data/akshare/<id>.json`；
3. 验证 `fetchRawCompany('<id>')` 的 financial 切片来自真实数据（`sources` 里 `akshare.ok=true`）。

### P2 · 巨潮 / 聚合（时间充裕再做）
- `cninfo.ts`：实现公告查询，用已写好的 `classify()` 做标题分类；注意 UA 与限流。
- `juhe.ts`：注册免费 key 写入 `.env`（**绝不提交 .env**），映射 `legal` 切片。

### P3 · 数据清洗强化
`fetcher.ts` 的 `normalize()` 已有基础版（去重/排序）。可增强：异常值剔除（如 revenue<0）、缺失年插值标记、金额单位二次校验。

## 3. 硬规则（破坏任何一条 = 联调事故）

1. **adapter 永不抛异常**：内部 try/catch 全包裹，失败返回 `null`，由 fetcher 降级；
2. **失败必须诚实**：不允许伪造 `ok:true`；`fallback:true` 会在前端展示为"降级"角标，这是加分项不是耻辱；
3. **单位纪律**：金额=万元，比例=百分数（45 不是 0.45），日期=ISO `YYYY-MM-DD`；
4. **质押约定**：`people[]` 中 `event:'质押'` 的 `amount` 填**累计质押比例（%）**——这是与分析引擎的隐性契约；
5. 新增 mock 公司 → 在 `adapters/mock.ts` 的 `MOCK_REGISTRY` 注册，并在 `lib/presets.ts` 挂到首页。

## 4. 降级策略原理（已内置，理解即可）

```text
fetchRawCompany(id)
  ├─ mock 底版（如存在）          → meta.sources += {mock, ok}
  ├─ 并行 4 个真实 adapter
  │    每个成功 → 按切片覆盖底版（financial/announcements/legal/sentiment/people）
  │    每个失败 → sources 标记 {name, ok:false, fallback:true}
  └─ mock 不存在 && 真实源全灭 → 抛 CompanyNotFoundError → API 返回 404
```

## 5. 验收标准（联调关卡）

- [ ] `fetchRawCompany('mock-healthy')` 返回结构完整对象，耗时 < 2s；
- [ ] 拔掉网线重启，3 家 mock 全部正常返回，UI 无报错；
- [ ] 至少 1 个 adapter 是真实数据（GDELT 或 AKShare），`sources` 可证明；
- [ ] 新增一家真实公司，走通"预跑脚本 → JSON → API 出参"全链路。

## 6. 给 Agent 的提示词（可直接粘贴）

> 实现 lib/data 层，严格返回 RawCompanyData（见 lib/types.ts）。所有 adapter 用 try/catch 包裹，失败静默降级到 data/mock。补完 scripts/prefetch-akshare.py 的字段映射，并把 gdelt.ts 的 tone 聚合打磨到可用。完成后用 curl 验证 sources 角标如实反映成功/降级。

## 7. 扩展路线（黑客松之后）

- 缓存换 SQLite/Redis（当前进程内 Map 多实例不共享）；
- 适配器加健康检查与熔断；
- 公告正文 PDF 下载 + LLM 摘要进 `summary` 字段。
