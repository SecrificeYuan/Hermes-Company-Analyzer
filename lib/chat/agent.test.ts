// lib/chat/agent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatMessage } from '@/lib/llm/client'

vi.mock('@/lib/llm/client', () => ({
  llmAvailable: vi.fn(() => true),
  chatOnce: vi.fn(),
  chatStream: vi.fn(),
}))
vi.mock('./tools', () => ({ toolSpecs: [], executeTool: vi.fn() }))

import { chatOnce, chatStream } from '@/lib/llm/client'
import { executeTool } from './tools'
import { runAgent } from './agent'

const USER: ChatMessage[] = [{ role: 'user', content: '我妈要买理财' }]

describe('lib/chat/agent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('无主体输入：模型直接追问（不调工具，单轮流式输出）', async () => {
    vi.mocked(chatOnce).mockResolvedValueOnce({ content: null, toolCalls: null, finishReason: 'stop' })
    vi.mocked(chatStream).mockImplementation(async function* () {
      yield { type: 'delta', text: '请问是哪家理财公司？' }; yield { type: 'done' }
    })
    const events: { type: string }[] = []
    const finalText = await runAgent(USER, (e) => events.push(e))
    expect(finalText).toBe('请问是哪家理财公司？')
    expect(executeTool).not.toHaveBeenCalled()
    expect(events.some((e) => e.type === 'delta')).toBe(true)
  })

  it('工具轮：tool_start 事件 + 报告卡事件 + 结果回灌后继续', async () => {
    vi.mocked(chatOnce)
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: 'c1', name: 'confirm_company', arguments: { name: 'XX财富' } }], finishReason: 'tool_calls' })
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: 'c2', name: 'run_health_check', arguments: { company_id: 'xx', scenario: '买理财' } }], finishReason: 'tool_calls' })
      .mockResolvedValueOnce({ content: null, toolCalls: null, finishReason: 'stop' })
    vi.mocked(executeTool)
      .mockResolvedValueOnce({ found: true, company: { id: 'xx', name: 'XX财富' } })
      .mockResolvedValueOnce({ reportCard: { reportId: 'xx', overallRisk: 'red', name: 'XX财富', verdict: 'v', debuffItems: [], asOf: '2026-10-03', scenario: '买理财' } })
    vi.mocked(chatStream).mockImplementation(async function* () { yield { type: 'done' } })
    const events: { type: string; name?: string }[] = []
    await runAgent(USER, (e) => events.push(e))
    expect(events.filter((e) => e.type === 'tool_start').map((e) => e.name)).toEqual(['confirm_company', 'run_health_check'])
    expect(events.some((e) => e.type === 'report_card')).toBe(true)
    expect(chatOnce).toHaveBeenCalledTimes(3)
  })

  it('每个工具执行完发出 tool_end 事件（成对出现，供前端停动画）', async () => {
    vi.mocked(chatOnce)
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: 'c1', name: 'suggest_companies', arguments: {} }], finishReason: 'tool_calls' })
      .mockResolvedValueOnce({ content: null, toolCalls: null, finishReason: 'stop' })
    vi.mocked(executeTool).mockResolvedValueOnce({ suggestions: [] })
    vi.mocked(chatStream).mockImplementation(async function* () { yield { type: 'done' } })
    const events: { type: string; name?: string }[] = []
    await runAgent(USER, (e) => events.push(e))
    const starts = events.filter((e) => e.type === 'tool_start')
    const ends = events.filter((e) => e.type === 'tool_end')
    expect(ends.map((e) => e.name)).toEqual(starts.map((e) => e.name))
  })

  it('工具返回 {error} 时回灌模型，不中断循环', async () => {
    vi.mocked(chatOnce)
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: 'c1', name: 'run_xray', arguments: { company_id: 'x' } }], finishReason: 'tool_calls' })
      .mockResolvedValueOnce({ content: null, toolCalls: null, finishReason: 'stop' })
    vi.mocked(executeTool).mockResolvedValueOnce({ error: '适配器超时' })
    vi.mocked(chatStream).mockImplementation(async function* () { yield { type: 'done' } })
    await runAgent(USER, () => {})
    const secondCallMessages = vi.mocked(chatOnce).mock.calls[1][0].messages
    expect(JSON.stringify(secondCallMessages)).toContain('适配器超时')
  })

  it('循环上限 6 轮：第 6 轮仍 tool_calls 时强制收尾', async () => {
    for (let i = 0; i < 6; i++) {
      vi.mocked(chatOnce).mockResolvedValueOnce({ content: null, toolCalls: [{ id: `c${i}`, name: 'suggest_companies', arguments: {} }], finishReason: 'tool_calls' })
    }
    vi.mocked(executeTool).mockResolvedValue({ suggestions: [] })
    vi.mocked(chatStream).mockImplementation(async function* () { yield { type: 'delta', text: '资料不足，无法完成评估。' }; yield { type: 'done' } })
    const text = await runAgent(USER, () => {})
    expect(chatOnce).toHaveBeenCalledTimes(6)
    expect(text).toContain('资料不足')
  })

  it('模型伪造 <tool_call> 文本：纠正回灌后重跑，伪调用不外流', async () => {
    vi.mocked(chatOnce)
      .mockResolvedValueOnce({
        content: '<tool_call>get_risk_factor\n<arg_key>company_id</arg_key>\n<arg_value>603986</arg_value>\n</tool_call>',
        toolCalls: null,
        finishReason: 'stop',
      })
      .mockResolvedValueOnce({ content: null, toolCalls: null, finishReason: 'stop' })
    vi.mocked(chatStream).mockImplementation(async function* () {
      yield { type: 'delta', text: '兆易创新的结论如下。' }; yield { type: 'done' }
    })
    const events: { type: string; text?: string }[] = []
    const text = await runAgent(USER, (e) => events.push(e))
    expect(text).not.toContain('<tool_call')
    expect(text).toContain('兆易创新')
    expect(events.filter((e) => e.type === 'delta').map((e) => e.text).join('')).not.toContain('<tool_call')
    // 纠正提示已回灌给第二轮
    const secondMessages = JSON.stringify(vi.mocked(chatOnce).mock.calls[1][0].messages)
    expect(secondMessages).toContain('get_risk_factor')
    expect(secondMessages).toContain('不要在正文里输出')
  })

  it('流式正文混入 <tool_call> 块：增量剥除，只发干净文本', async () => {
    vi.mocked(chatOnce).mockResolvedValueOnce({ content: null, toolCalls: null, finishReason: 'stop' })
    vi.mocked(chatStream).mockImplementation(async function* () {
      yield { type: 'delta', text: '好的。' }
      yield { type: 'delta', text: '<tool_call>get_risk_factor</tool_call>' }
      yield { type: 'delta', text: '结论是稳定的。' }
      yield { type: 'done' }
    })
    const events: { type: string; text?: string }[] = []
    const text = await runAgent(USER, (e) => events.push(e))
    expect(text).toBe('好的。结论是稳定的。')
    expect(events.filter((e) => e.type === 'delta').map((e) => e.text).join('')).toBe('好的。结论是稳定的。')
  })

  it('chatOnce 返回 null（网络故障）：回退模板话术，不调 chatStream', async () => {    vi.mocked(chatOnce).mockResolvedValue(null)
    const text = await runAgent(USER, () => {})
    expect(text.length).toBeGreaterThan(0)
    expect(chatStream).not.toHaveBeenCalled()
  })

  it('llmAvailable=false：直接返回未配置话术', async () => {
    const { llmAvailable } = await import('@/lib/llm/client')
    vi.mocked(llmAvailable).mockReturnValue(false)
    expect(await runAgent(USER, () => {})).toContain('未配置')
  })
})
