# Agent Notes 制度

文档写"是什么"，notes 写"为什么这么定"。非平凡变更的 note 与变更**同一次提交**。

## 目录结构

```
.agents/notes/{lifecycle}/{class}/YYYY-MM-DD-slug.md
```

- **lifecycle**：`proposed` / `implemented` / `rejected` / `archived`
- **class**（封闭集合，严禁扩充）：`feature` / `bug-fix` / `simplification` / `architecture` / `process` / `testing`

## 五条纪律

1. 非平凡变更的 note 与变更同一次提交——留痕不过夜
2. **禁止全局 INDEX 文件**——目录树即索引（多分支合并永不冲突）
3. `Alternatives considered` 强制必填——记备选方案和为什么没选
4. `implemented` 只写事实（做了什么、结果如何），不写计划
5. 简体中文

## 生命周期流转

`proposed` → `implemented`（落地后移动文件，改写为事实口径）/ `rejected`（记原因）；过时 → `archived`。

## 并行协作

- **开工认领**：并行单元（worktree/分支/worker）开工时写 `proposed/process/` 笔记：文件边界、认领的契约文件、依赖谁的产出
- **完工销认**：落地后转 `implemented`，记录实际交付与边界遵守情况
- **状态地图**：目录树即"当前有哪些平行线在跑"——合并/验收前先看认领笔记
- 认领笔记是记录不是锁：事中互斥（契约独占/单一执行者）由 `AGENTS.md` 契约强制执行

## 模板

见 `模板.md`。
