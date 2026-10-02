# 设计文档 · AI 对话与 X 光评估

> 2026-10-03。配合 [PRD-HACKATHON-XRAY.md](../PRD-HACKATHON-XRAY.md) 的「对话管线」与
> 「信号引擎扩展」两节，本文档是与用户逐项拷问（grilling）+ 视觉伴侣走查后定稿的实施方案。
> 前置决策讨论见会话记录；本文档为实现计划的唯一准绳。

## 背景与目标

PRD 定调：产品本体是面板和灯，对话只是把小白带过来的路。本次接入 AI 的目标：

1. 首页新增第三模式「对话」：用户用大白话（"我妈要买理财"）发起支付前评估；
2. AI 作为路由器 + 翻译官：意图分类 → 主体识别 → 澄清追问 → 路由 → 人话叙事；
3. 叙事层正式接线 `lib/analysis/verdict.ts` 预留的 `VerdictRefiner` hook；
4. 信号引擎扩展非上市红灯信号、品类专属弹药、叠加致死规则（PRD 既定，本文档定实现形态）。

非目标（YAGNI）：多 provider 路由、监控推送、通用时间机器、全量工商名录（见 PRD Out of Scope）。

## 基础设施

- LLM 网关：`https://tokendance.space/gateway/v1`（OpenAI 兼容协议），模型 `ling-3.1-flash`
  （实测支持 function calling 与 `response_format: json_object`；为推理模型，`reasoning_content`
  会消耗 max_tokens，调用预算必须给足）。
- 环境变量（已写入 `.env.example`）：`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`。
  三者任一未配置 = 无 LLM 环境，对话模式禁用（见前端节）。
- Key 存于 `.env.local`（git 已忽略），严禁写入代码或文档。

## 架构与新模块

```
lib/llm/client.ts        OpenAI 兼容网关薄客户端：fetch + 超时 + JSON 解析失败重试 1 次
lib/chat/agent.ts        Agent 循环：消息 → LLM(tools) → 执行工具 → 回灌 → 至无 tool_calls
lib/chat/tools.ts        4 个工具定义，全部为现有 lib 函数的薄包装
app/api/chat/route.ts    SSE 流式路由，事件见下
app/chat/page.tsx        全屏对话页
components/chat/         ChatWindow / MessageBubble / ReportCard / ChatInput
lib/chat-history.ts      最近对话 localStorage（沿用 lib/search-history.ts 模式，上限 3 条）
```

依赖方向（红线）：

- `lib/chat` 可以 import `lib/data`、`lib/llm`、`lib/analysis`；
- `lib/analysis` 保持纯函数，不 import 网络/fs/LLM——LLM 只出现在编排层与对话层；
- `get-xray.ts` 是唯一同时触碰数据层、分析层、LLM 的编排点。

### 叙事层接线（get-xray.ts）

`analyze()` 产出确定性结果后：若配置了 LLM，以 `VerdictRefinementRequest`
（draft + overallRisk + hiddenStatus 证据）调用网关润色 `verdict`/`advice`，
经 `applyVerdictRefinement` 守卫——风险档不一致、超时、空文本一律回退模板。
LLM 不得改变分数、隐藏状态与证据。报告页与对话管线共用同一份润色结论，
对话里的 Agent 最终回复本身就是叙事层：其可见数字必须能在面板数据中找到出处。

## 对话管线（/api/chat）

### 请求与状态

- `POST /api/chat`，body `{ messages: ChatMessage[] }`，**无状态**：客户端持有全量
  消息数组，每次请求完整携带。服务端不设会话存储。
- 响应为 SSE（`ReadableStream`），事件类型：
  - `thinking` — 模型推理中（心跳，防界面死寂）
  - `tool_start { name, label }` — 如「正在查询公司…」，前端渲染灰色进度行
  - `delta { text }` — 最终回复的流式 token
  - `report_card { reportId, snapshot }` — 评估完成，携带迷你面板渲染所需快照
  - `done` / `error { message }`

### Agent 循环

system prompt 承载（不暴露为工具）：意图七分类（买股票/买理财/加盟/报班培训/
办卡预付费/供应商预付/其他）、澄清追问原则、荐股拒绝与重定向、数字引用铁律。
循环上限 6 轮防死循环，超出后强制以现有信息生成最终回复。

澄清追问 = 模型不调用任何工具、直接开口问用户（"请问是哪家理财公司？"）；
主体不可靠时禁止生成评估（PRD 铁律）。比较类追问（"那这家和 XX 比呢"）=
模型自行连调两次评估工具后用口播对比，不设 compare 工具。

### 工具集（4 个，已定稿）

| 工具 | 包装 | 说明 |
|---|---|---|
| `suggest_companies(name)` | `suggestCompanies`（lib/data/eastmoney） | 候选列表，供模型消歧 |
| `confirm_company(company_id)` | `searchCompanies` 精确命中语义（lib/data/company-discovery） | `{found, company}`，唯一命中才继续 |
| `run_xray(company_id)` | `getXRay`（lib/get-xray.ts） | 上市主体；6s 适配器总时限，超时用已返回源计算 |
| `run_health_check(company_id)` | `findCompany` + `getCompanyHealth` + `healthToXray` | 非上市主体健康评估入口 |

工具出错/超时：结果以 `{error: '...'}` 回灌模型，由模型向用户诚实说明
（"资料不足就是资料不足"），不抛异常给前端。

## 前端

### 首页（三模式一致结构）

- `queryMode` 扩展为 `'search' | 'filter' | 'chat'`；「对话」tab 选中后 Hero 保持
  标题区不变，下方仅一个输入框，占位符为用户原话示例（"我妈要买理财"）。
- 输入框下方：最近对话 chips（≤3 条，localStorage），点击携带该对话历史跳 `/chat`。
- 无 LLM：「对话」tab 可见但禁用，悬停提示「AI 功能未配置」。

### /chat 全屏对话页

- 顶栏：「← 返回首页 · HERMES · 对话」。
- 消息流：用户气泡 / AI 气泡（delta 流式）/ tool 进度行 / 报告卡迷你面板。
- 底部输入框常显，支持多轮追问（用户故事 12）。

### 报告卡（视觉已定稿）

迷你面板：灯（红/黄/绿圆章）+ 公司名 + 逐条 debuff 人话解释（一行一条，含一句
"历史上这意味着什么"）+ 资料截至时间 + 「完整 X 光与证据链 →」按钮跳 `/report/[id]`。
对话里不展示攻防数值（噪音）；完整面板与证据链永远是报告页职责。

## 信号引擎扩展（lib/analysis 纯函数层）

- 新增跨品类红灯：诉讼缠身/被执行、经营异常/行政处罚、老板跑路前兆（法人频繁
  变更/减资/股权出质）、口碑崩塌（投诉量趋势）、欠薪信号。输入字段缺失 → 规则
  不触发（与「资料不足」语义一致）。
- 新增品类弹药：加盟未备案招商 = 红灯（商务部特许经营备案）；理财无牌照向公众
  募资 = 致命 debuff；预付费品类（健身/培训）跑路前奏 = 成立时长/参保人数与开店
  速度比值/大额折扣预售的组合判定。
- 叠加致死：致命 debuff（无牌照/未备案招商）任一命中即红灯；非致命 debuff
  叠加数 ≥3 升一档。阈值与 `overallRisk` 三档语义对齐。
- 剧本库：人工整理 3–5 个真实案例（培训/健身/理财/A 股各一），结局统计标注
  "历史不代表未来"。黑客松只做演示所需。
- 新增 fixture：mock-gym-danger / mock-franchise-unfiled / mock-wealth-unlicensed，
  附预期亮灯基线表；原有 mock-healthy/warning/danger 三档回归必须通过。

## 数据落地

- 演示案例（十家量级）的非上市数据走**人工采集快照**：来源与采集时间随证据链
  展示（与现有"过程缓存+来源标注"语义兼容）。爱企查不做实时自动来源（robots/匿名空数据）。
- 黑猫投诉真实接口限时评估（约 1 小时），调不通则同样走快照。
- 新适配器沿用现有超时与降级模式：单源超时 null、6s 总时限、`meta.sources`
  记录 ok/fallback、切片缺失不阻塞面板渲染。

## 测试

- 对话管线：固定用例集（"我妈要买理财" / "我想购买 XXX 股票 100 股" /
  "帮我看看 XX 健身"）断言意图、主体与路由，挂 /api/chat 最高 seam，LLM 以 stub
  替代；无主体输入的澄清追问路径必须有用例；荐股输入断言拒绝并重定向。
- 叙事层：模板回退路径快照测试；LLM 路径只断言「输出中的数字均能在输入数据
  中找到出处」，不断言措辞。
- 信号引擎：fixture 单测 + 基线表复测；mock 三档回归。
- 验证命令：`npm run typecheck`、`npm run test`、`npm run build` + DOC-B 三档 curl 复测。

## 合规边界（继承 PRD）

不输出买卖建议、不预测收益、回报率保持 null；历史剧本统计标注"历史不代表未来"；
被用户要求荐股时礼貌拒绝并重定向到风险评估；所有新信号沿用「可见信号」层面措辞。
