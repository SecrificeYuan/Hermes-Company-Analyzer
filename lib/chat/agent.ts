// Agent 循环：tools 轮回灌、最终轮流式输出、6 轮上限、失败回退模板。
// 强化版：system prompt 带工具决策树；支持 reportContext 注入（报告页追问）；
// 多轮 history 自动瘦身（早期 tool 结果截断，防 token 膨胀）。
import type { ChatMessage } from '@/lib/llm/client'
import { llmAvailable, chatOnce, chatStream } from '@/lib/llm/client'
import { toolSpecs, executeTool } from './tools'

export type AgentEvent =
  | { type: 'thinking' }
  | { type: 'tool_start'; name: string; label: string }
  | { type: 'tool_end'; name: string }
  | { type: 'delta'; text: string }
  | { type: 'report_card'; reportCard: Record<string, unknown> }

const FALLBACK_TEXT = 'AI 服务暂时不可用，请稍后再试，或直接使用搜索模式查询公司。'

const EXHAUSTED_APPEND: ChatMessage = {
  role: 'user',
  content: '请基于已获得的信息立即给出最终结论，不要再调用工具。',
}

/** 模型有时不走高层的 function-calling 协议，而在正文里手写 <tool_call> 伪调用——一律剥掉 */
const TOOL_CALL_BLOCK_RE = /<tool_call[\s\S]*?(?:<\/tool_call>|$)/gi

function stripToolCallBlocks(text: string): string {
  return text.replace(TOOL_CALL_BLOCK_RE, '')
}

/** 模型伪造工具后的纠正回灌：明确可用工具白名单，逼它回到协议或直接回答 */
const ANTI_HALLUCINATION_APPEND: ChatMessage = {
  role: 'user',
  content:
    '提醒：你没有 get_risk_factor 或任何其它未定义的工具。可用工具见系统提示的工具清单；工具由系统自动执行，不要在正文里输出 <tool_call> 标签或任何工具名。请直接回答用户。',
}

export const SYSTEM_PROMPT = `你是 Hermes 公司分析助手的对话内核。用户想对一家公司付钱，你负责在收钱之前把这家公司扒清楚。

## 意图七类
用户输入必须归入以下七类之一：买股票 / 买理财 / 加盟 / 报班培训 / 办卡预付费 / 供应商预付 / 其他。

## 五条铁律
1. 主体不明必须追问，禁止猜测公司 ID 或主体；先用 suggest_companies / confirm_company 消歧。
2. 所有数字（风险分、负债、处罚次数等）必须来自工具返回，禁止编造。
3. 用户要求荐股（买哪只、能不能抄底等）必须拒绝，并重定向到风险分析。
4. 资料不足时如实说明，并指出缺的是哪一块数据。
5. 所有结论必须附上"历史数据不代表未来表现"的提示。
6. 可用的工具由系统自动执行；禁止在回复正文里提及工具名、禁止手写 <tool_call> 等调用标签。

## 工具决策树（什么问题用什么工具）
- 用户提到公司但主体不明确 → suggest_companies / confirm_company 消歧
- 上市公司完整尽调 → run_xray（约 6 秒）
- 非上市/工商主体轻量尽调 → run_health_check
- 「最近股价/市值/市盈率/跌了吗」→ get_market_quote
- 「主力/资金在跑吗/谁在买」→ get_fund_flow
- 「最近有什么新闻/舆情/出了什么事」→ get_news
- 「A 和 B 哪家更稳/对比」→ compare_companies
- 「最近公告/发了什么公告」→ get_announcements

## 出片后口播（拿到 X 光/健康检查结果后必须继续说话，禁止只出卡片就结束）
你是用户的私人投资助理，把结果翻译成人话讲给用户听，固定四段结构：
1. 一句话结论：灯色 + 这笔钱还要不要继续往下谈。
2. 关键证据 2-3 条：引用结果里的具体数字与信号（血条/护甲/风险分、命中的减分项及其描述），禁止编造数字。
3. 场景化行动建议：结合用户的支付场景给"下一步怎么做"，要具体到能照做——
   - 买理财：列出"回家问销售的三个问题"
   - 入职背调：列出"offer 谈判时值得追问的点"
   - 供应商预付/赊账：列出"合同里建议加的条款类型"
   - 买股票：给出仓位控制与止损纪律、需要继续盯的信号
   - 加盟/报班/办卡：列出付款前必须让对方出示/写进合同的材料
4. 诚实提示 + 邀请追问：声明历史数据不代表未来表现，然后问用户想继续深挖哪一块。
没有拿到工具结果时，不许假装已经分析过。`

const TOOL_LABELS: Record<string, string> = {
  suggest_companies: '正在搜索公司…',
  confirm_company: '正在核对主体…',
  run_xray: '正在拍摄 X 光（约 6 秒）…',
  run_health_check: '正在评估主体健康度…',
  get_market_quote: '正在查询实时行情…',
  get_fund_flow: '正在查询资金流向…',
  get_news: '正在查询相关新闻…',
  compare_companies: '正在并排对比两家公司…',
  get_announcements: '正在查询近期公告…',
}

const MAX_ROUNDS = 6
/** history 超过该轮数后，最早的 tool 结果被截断为短占位（防 token 膨胀） */
const HISTORY_COMPACT_THRESHOLD = 6

/** 把 history 里过早的 tool 长结果瘦身成占位（保留最近 N 轮完整） */
function compactHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= HISTORY_COMPACT_THRESHOLD) return messages
  const toolIdx: number[] = []
  messages.forEach((m, i) => {
    if (m.role === 'tool') toolIdx.push(i)
  })
  if (toolIdx.length === 0) return messages
  // 保留最后一个完整 tool 结果；更早的替换为短占位
  const lastFull = toolIdx[toolIdx.length - 1]
  return messages.map((m, i) => {
    if (m.role === 'tool' && i !== lastFull && m.content && m.content.length > 200) {
      return { ...m, content: '[早期工具结果已折叠，结论已在后续 assistant 回复中体现]' }
    }
    return m
  })
}

export async function runAgent(
  history: ChatMessage[],
  onEvent: (e: AgentEvent) => void,
  reportContext?: ChatMessage[],
): Promise<string> {
  if (!llmAvailable()) return 'AI 功能未配置。'

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(reportContext ?? []),
    ...compactHistory(history),
  ]

  for (let round = 0; round < MAX_ROUNDS; round++) {
    onEvent({ type: 'thinking' })
    const result = await chatOnce({ messages, tools: toolSpecs, scene: 'chat' })
    if (!result) return FALLBACK_TEXT

    // 伪造 tool_call：没有真实 toolCalls 却在正文里手写 <tool_call>——纠正后重跑一轮，绝不当最终答案外流
    const rawContent = result.content ?? ''
    if (!result.toolCalls?.length && /<tool_call[\s>]/i.test(rawContent)) {
      messages.push({ role: 'assistant', content: rawContent })
      messages.push(ANTI_HALLUCINATION_APPEND)
      continue
    }

    if (result.toolCalls?.length) {
      const toolCallsMsg = result.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      }))
      messages.push({ role: 'assistant', content: stripToolCallBlocks(rawContent) || null, tool_calls: toolCallsMsg })
      for (const call of result.toolCalls) {
        onEvent({ type: 'tool_start', name: call.name, label: TOOL_LABELS[call.name] ?? call.name })
        const output = await executeTool(call.name, call.arguments)
        if (output.reportCard && typeof output.reportCard === 'object') {
          onEvent({ type: 'report_card', reportCard: output.reportCard as Record<string, unknown> })
        }
        messages.push({ role: 'tool', content: JSON.stringify(output), tool_call_id: call.id })
        onEvent({ type: 'tool_end', name: call.name })
      }
      continue
    }

    // 最终轮：流式输出（增量剥除可能漏网的伪 tool_call 块）
    return await streamFinal(messages, onEvent)
  }

  // 6 轮耗尽：强制收尾
  messages.push(EXHAUSTED_APPEND)
  const text = await streamFinal(messages, onEvent)
  return text.trim().length > 0 ? text : '资料不足，无法完成评估。建议先补充查询公司全称。'
}

/** 流式收尾：边收边剥 <tool_call> 块，只把干净文本增量发给前端 */
async function streamFinal(messages: ChatMessage[], onEvent: (e: AgentEvent) => void): Promise<string> {
  let text = ''
  let sent = 0
  for await (const ev of chatStream({ messages, scene: 'chat' })) {
    if (ev.type === 'delta') {
      text += ev.text
      const cleaned = stripToolCallBlocks(text)
      if (cleaned.length > sent) {
        onEvent({ type: 'delta', text: cleaned.slice(sent) })
        sent = cleaned.length
      }
    }
  }
  return sent > 0 ? stripToolCallBlocks(text) : ''
}
