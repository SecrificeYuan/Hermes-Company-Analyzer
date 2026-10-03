import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/llm/client', () => ({
  llmAvailable: vi.fn(() => true),
  chatOnce: vi.fn(),
  chatStream: vi.fn(),
}))
vi.mock('@/lib/chat/tools', () => ({ toolSpecs: [], executeTool: vi.fn() }))
// runAgent 用真实实现，其上两层被 mock 覆盖

import { chatOnce, chatStream } from '@/lib/llm/client'
import { executeTool } from '@/lib/chat/tools'
import { POST } from '../../app/api/chat/route'

async function readSse(res: Response): Promise<{ type: string;[k: string]: unknown }[]> {
  const text = await res.text()
  return text.split('\n\n').filter(Boolean).map((block) => JSON.parse(block.replace(/^data: /, '')))
}

describe('POST /api/chat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('「我妈要买理财」→ 澄清追问（无主体不评估，不调工具）', async () => {
    vi.mocked(chatOnce).mockResolvedValueOnce({ content: null, toolCalls: null, finishReason: 'stop' })
    vi.mocked(chatStream).mockImplementation(async function* () {
      yield { type: 'delta', text: '请问是哪家理财公司？把公司全称发给我。' }; yield { type: 'done' }
    })
    const res = await POST(new Request('http://x/api/chat', {
      method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: '我妈要买理财' }] }),
    }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
    const events = await readSse(res)
    expect(events.at(-1)?.type).toBe('done')
    expect(executeTool).not.toHaveBeenCalled()
  })

  it('「我想购买贵州茅台股票」→ confirm + run_xray + 报告卡 + done', async () => {
    vi.mocked(chatOnce)
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: 'c1', name: 'confirm_company', arguments: { name: '贵州茅台' } }], finishReason: 'tool_calls' })
      .mockResolvedValueOnce({ content: null, toolCalls: [{ id: 'c2', name: 'run_xray', arguments: { company_id: '600519', scenario: '买股票' } }], finishReason: 'tool_calls' })
      .mockResolvedValueOnce({ content: null, toolCalls: null, finishReason: 'stop' })
    vi.mocked(executeTool)
      .mockResolvedValueOnce({ found: true, company: { id: '600519', name: '贵州茅台' } })
      .mockResolvedValueOnce({ reportCard: { reportId: '600519', overallRisk: 'green', name: '贵州茅台', verdict: 'v', debuffItems: [], asOf: '2026-10-03', scenario: '买股票' } })
    vi.mocked(chatStream).mockImplementation(async function* () { yield { type: 'done' } })
    const res = await POST(new Request('http://x/api/chat', {
      method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: '我想购买贵州茅台股票' }] }),
    }))
    const events = await readSse(res)
    expect(events.some((e) => e.type === 'report_card')).toBe(true)
    expect(events.some((e) => e.type === 'tool_start')).toBe(true)
    expect(events.at(-1)?.type).toBe('done')
  })

  it('messages 缺失/为空 → 400 JSON', async () => {
    expect((await POST(new Request('http://x/api/chat', { method: 'POST', body: '{}' }))).status).toBe(400)
    expect((await POST(new Request('http://x/api/chat', { method: 'POST', body: JSON.stringify({ messages: [] }) }))).status).toBe(400)
  })

  it('非法 JSON body → 400', async () => {
    expect((await POST(new Request('http://x/api/chat', { method: 'POST', body: 'not-json' }))).status).toBe(400)
  })

  it('llmAvailable=false → 503 {available:false}', async () => {
    const { llmAvailable } = await import('@/lib/llm/client')
    vi.mocked(llmAvailable).mockReturnValue(false)
    const res = await POST(new Request('http://x/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }) }))
    expect(res.status).toBe(503)
  })
})
