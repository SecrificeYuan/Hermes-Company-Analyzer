# DOC-C · 前端渲染系统（分支 `feat/frontend-xray`）

> **你的职责：** 让评委在 3 秒内"哇"出来。
> **铁律：** 只消费 `CompanyXRay`（[lib/types.ts](../lib/types.ts)），**绝不** import `RawCompanyData` 或 `data/mock/*.json`；数据一律来自 `/api/company/[id]/xray` 或页面服务端 `getXRay()`。

---

## 1. 现状基线（已完成，端到端可跑）

> 布局基线以 docs/superpowers/specs/2026-10-02-report-redesign-design.md 为准（2026-10-02 起替代旧基线）。

| 模块 | 状态 | 说明 |
|---|---|---|
| 设计 token | ✅ 冻结 | `tailwind.config.ts` + `lib/theme/tokens.ts`（两处同步修改） |
| ECharts 暗色基底 | ✅ 冻结 | `lib/theme/echarts-dark.ts`；封装件 `components/xray/EChart.tsx`（自研，替代 echarts-for-react 以兼容 React 19） |
| 首页 | ✅ 基线 | 搜索 + 预设公司 + 扫描过场（`components/scan/`） |
| 报告页 | ✅ 基线 | 全部 10 个模块已接线，stagger 入场 |
| 对比页 | ✅ 基线 | 并排四维条形；雷达叠加/diff 待做 |
| 分享卡 | ✅ 基线 | html2canvas 导出 1200×630 PNG |
| 证据抽屉 | ✅ 基线 | zustand 驱动，右侧滑出 |

**布局（已实现，按此迭代）：**
```text
顶栏（保留：重新扫描 / 双公司对比 / 分享 / 模式切换）
头        LITE：角色横幅(CharacterCard)   PRO：元信息条(MetaStrip)
速览层    版式驱动（lib/narrative.ts：narrativeOf → glanceLayout）
          PRO：5 图位，C 位 2×2 放大（均衡版式 = 雷达大图）
          LITE：C 位叙事大卡 + 3 迷你卡(MiniDimCard)
详读层    PRO：AnchorNav(scroll-spy) + 七 section（components/xray/detail/，顺序随版式）
          LITE：叙事卡流（NarrativeCard ×5，证据入口在每张卡）
页脚（保留）+ EvidenceDrawer（全局）
```

## 2. 你的任务清单（按优先级）

### P0 · 视觉打磨（"哇"的直接来源）
- **扫描线记忆点**：`VerdictBanner` 顶部 2px 霓虹线已有基线（`animate-scanline`）；进阶版让光束扫过页面时各模块依次"点亮"（光束位置 → 模块 opacity/glow 联动）；
- **数字终端感**：所有数字必须 `font-mono`（JetBrains Mono 栈）+ `StatNumber` 滚动计数，排查漏网之鱼；
- **HP 血条**：<30% 呼吸红光已有；可加低血量时的屏幕边缘泛红晕；
- 图表空态检查：3 家公司逐一过，`ChartEmpty` 占位不得破版。

### P1 · 交互深化
- 隐藏状态卡 → 证据抽屉已通；给抽屉加键盘 ESC 关闭与焦点圈定；
- RiskTimeline：点击事件气泡 → 若有对应 debuff 则联动打开抽屉；
- RelationGraph：点击节点高亮邻接边（`emphasis.focus` 已有），加节点类型图例；
- 对比页：双雷达叠加 + 逐项 diff 箭头 + "胜负"判定动画。

### P2 · 动效性能
- ECharts 全部 `notMerge` 更新；页面切走后图表 dispose（`EChart.tsx` 已处理）；
- framer-motion 大量 `initial/animate` 已就位，低端机掉帧时用 `whileInView` + `viewport={{ once: true }}` 替换首屏外的入场动画。

### P3 · 分享卡美化
当前是信息直排。可做成竖版角色卡样式（血条图形化 + debuff 徽章墙），导出逻辑不变。

## 3. 设计系统速查

```text
背景  #070B14      卡片  rgba(18,26,43,.72) + backdrop-blur + 1px rgba(0,229,255,.12)
霓虹  #00E5FF      危险  #FF3B5C      警告  #FFB020      安全  #00E58A      紫  #8B5CF6
圆角  卡片 16px / 按钮 8px      发光  shadow-glow (0 0 24px rgba(0,229,255,.25))
入场  stagger 0.05s（variants 在 XrayClient）     扫描光束 2.5s 循环
```

- Tailwind 取色：`bg-ink-bg` `text-neon` `border-danger` `shadow-glow` `animate-scanline` `animate-breathe`；
- JS 取色（ECharts）：`import { colors } from '@/lib/theme/tokens'`；
- 通用样式类：`.glass-card` `.glass-card-hover` `.text-glow` `.bg-grid`。

## 4. 数据获取方式（两种，按场景选）

```tsx
// Server Component（报告页在用）：免 HTTP 自请求
import { getXRay } from '@/lib/get-xray'
const xray = await getXRay(id)

// Client Component（对比页在用）：
const xray = await fetch(`/api/company/${id}/xray`).then(r => r.json())
```

404 语义：`CompanyNotFoundError` → 页面走 `not-found.tsx`，fetch 收到 `{ error: 'COMPANY_NOT_FOUND' }`。

## 5. 契约缺口与绕行（改契约前先读这里）

| 你想要的 | 现状 | 绕行方案 |
|---|---|---|
| 诉讼热力图按"案由类型"分行 | timeline 只有 category/severity | 基线按 severity 分行；要案由需分析引擎把 cause 写进 event 文本 → 走契约变更 |
| 现金流/舆情 X 轴标签 | v1.1 已加 `hp.labels`/`morale.labels`（可选） | 直接用，缺失时回退"期 N" |
| 数据来源角标 | v1.1 已加 `xray.sources`（可选） | `DataSourceBadge` 已实现 |

**契约变更流程：** 三人群里发diff → 改 `lib/types.ts` → 同步三份 docs → 各分支 rebase。单方面改 = 联调事故。

## 6. 验收标准（联调关卡）

- [ ] 3 家公司渲染且绿/黄/红视觉差异**一眼可辨**；
- [ ] 断网 + 空数据字段（如把 mock 的 sentiment 删空）UI 不崩，缺失模块显示"数据暂缺"；
- [ ] 每条隐藏状态可点开证据抽屉，至少 2 条证据卡；
- [ ] 分享卡导出 PNG 成功且可读；
- [ ] Lighthouse 性能分 ≥ 80（演示机实测）。

## 7. 给 Agent 的提示词（可直接粘贴）

> 实现 components/xray 下所有组件，统一消费 CompanyXRay 接口，不得触碰 RawCompanyData。ECharts 配置从 lib/theme/echarts-dark.ts 的基底展开，所有图表包 framer-motion 入场动画。数字一律 font-mono + StatNumber 滚动计数。优先保证 3 家 mock 数据下绿/黄/红视觉差异明显，断网空数据有占位不崩版。

## 8. 扩展路线（黑客松之后）

- 报告页 WebGL 粒子背景（ react-three-fiber ）；
- 分享卡服务端渲染（`@vercel/og`，免 html2canvas 字体问题）；
- 公司搜索接入真实 A 股名录（依赖数据引擎 P1）。
