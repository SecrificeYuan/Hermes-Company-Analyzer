// Agent 循环：tools 轮回灌、最终轮流式输出、6 轮上限、失败回退模板。
import type { ChatMessage } from '@/lib/llm/client'
import { llmAvailable, chatOnce, chatStream } from '@/lib/llm/client'
import { toolSpecs, executeTool } from './tools'

export type AgentEvent =
  | { type: 'thinking' }
  | { type: 'tool_start'; name: string; label: string }
  | { type: 'delta'; text: string }
  | { type: 'report_card'; reportCard: Record<string, unknown> }

const FALLBACK_TEXT = 'AI 服务暂时不可用，请稍后再试，或直接使用搜索模式查询公司。'

const EXHAUSTED_APPEND: ChatMessage = {
  role: 'user',
  content: '请基于已获得的信息立即给出最终结论，不要再调用工具。',
}

export const SYSTEM_PROMPT = `你是 Hermes 公司分析助手的对话内核。用户想对一家公司付钱，你负责在收钱之前把这家公司扒清楚。

## 意图七类
用户输入必须归入以下七类之一：买股票 / 买理财 / 加盟 / 报班培训 / 办卡预付费 / 供应商预付 / 其他。

## 五条铁律
1. 主体不明必须追问，禁止猜测公司 ID 或主体；先用 suggest_companies / confirm_company 消歧。
2. 所有数字（风险分、负债、处罚次数等）必须来自工具返回，禁止编造。
3. 用户要求荐股（买哪只、能不能抄底等）必须拒绝，并重定向到风险分析。
4. 资料不足时如实说明，并指出缺的是哪一块数据。
5. 所有结论必须附上"历史数据不代表未来表现"的提示。`

const TOOL_LABELS: Record<string, string> = {
  suggest_companies: '正在搜索公司…',
  confirm_company: '正在核对主体…',
  run_xray: '正在拍摄 X 光（约 6 秒）…',
  run_health_check: '正在评估主体健康度…',
}

const MAX_ROUNDS = 6

export async function runAgent(history: ChatMessage[], onEvent: (e: AgentEvent) => void): Promise<string> {
  if (!llmAvailable()) return 'AI 功能未配置。'

  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history]

  for (let round = 0; round < MAX_ROUNDS; round++) {
    onEvent({ type: 'thinking' })
    const result = await chatOnce({ messages, tools: toolSpecs })
    if (!result) return FALLBACK_TEXT

    if (result.toolCalls?.length) {
      const toolCallsMsg = result.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      }))
      messages.push({ role: 'assistant', content: result.content, tool_calls: toolCallsMsg })
      for (const call of result.toolCalls) {
        onEvent({ type: 'tool_start', name: call.name, label: TOOL_LABELS[call.name] ?? call.name })
        const output = await executeTool(call.name, call.arguments)
        if (output.reportCard && typeof output.reportCard === 'object') {
          onEvent({ type: 'report_card', reportCard: output.reportCard as Record<string, unknown> })
        }
        messages.push({ role: 'tool', content: JSON.stringify(output), tool_call_id: call.id })
      }
      continue
    }

    // 最终轮：流式输出
    let text = ''
    for await (const ev of chatStream({ messages })) {
      if (ev.type === 'delta') {
        text += ev.text
        onEvent({ type: 'delta', text: ev.text })
      }
    }
    return text.trim().length > 0 ? text : FALLBACK_TEXT
  }

  // 6 轮耗尽：强制收尾
  messages.push(EXHAUSTED_APPEND)
  let text = ''
  for await (const ev of chatStream({ messages })) {
    if (ev.type === 'delta') {
      text += ev.text
      onEvent({ type: 'delta', text: ev.text })
    }
  }
  return text.trim().length > 0 ? text : '资料不足，无法完成评估。建议先补充查询公司全称。'
}
