import { describe, it, expect, vi, beforeEach } from 'vitest'

const chatOnceMock = vi.fn()
const llmAvailableMock = vi.fn()
const fetchRawMock = vi.fn()

vi.mock('@/lib/llm/client', () => ({
  chatOnce: (...args: unknown[]) => chatOnceMock(...args),
  chatStream: vi.fn(),
  llmAvailable: () => llmAvailableMock(),
}))

vi.mock('@/lib/data/fetcher', () => ({
  fetchRawCompany: (...args: unknown[]) => fetchRawMock(...args),
}))

import dangerJson from '@/data/mock/company-danger.json'

const raw = dangerJson as never

function chatResult(content: string) {
  return { content, toolCalls: null, finishReason: 'stop' }
}

describe('lib/get-xray 叙事层接线', () => {
  beforeEach(() => {
    vi.resetModules()
    chatOnceMock.mockReset()
    llmAvailableMock.mockReset()
    fetchRawMock.mockReset()
    fetchRawMock.mockResolvedValue(raw)
  })

  it('llmAvailable=false → 返回模板结果、不调 fetch、不调 chatOnce', async () => {
    llmAvailableMock.mockReturnValue(false)
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { getXRay } = await import('./get-xray')
    const xray = await getXRay('mock-danger', '买理财')
    expect(xray.verdict).toBeTruthy()
    expect(xray.nextSteps).toBeUndefined()
    expect(chatOnceMock).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('chatOnce 返回 null → 模板保留、nextSteps 不存在', async () => {
    llmAvailableMock.mockReturnValue(true)
    chatOnceMock.mockResolvedValue(null)
    const { getXRay } = await import('./get-xray')
    const xray = await getXRay('mock-danger', '买理财')
    expect(xray.nextSteps).toBeUndefined()
    expect(xray.verdict).toBeTruthy()
  })

  it('verdict 润色风险档被模型改成 green → 回退模板', async () => {
    llmAvailableMock.mockReturnValue(true)
    chatOnceMock.mockResolvedValue(
      chatResult(JSON.stringify({ verdict: '改过的结论', advice: '改过的建议', overallRisk: 'green' })),
    )
    const { getXRay } = await import('./get-xray')
    const xray = await getXRay('mock-danger')
    expect(xray.overallRisk).not.toBe('green')
    expect(xray.verdict).not.toBe('改过的结论')
    expect(xray.advice).not.toBe('改过的建议')
  })

  it('scenario 传入 + 合法 nextSteps JSON → nextSteps 存在；同 id 不同 scenario 缓存不共享', async () => {
    llmAvailableMock.mockReturnValue(true)
    chatOnceMock.mockImplementation(async ({ messages }: { messages: { role: string; content: string | null }[] }) => {
      const sys = messages.find((m) => m.role === 'system')?.content ?? ''
      if (sys.includes('nextSteps') || sys.includes('行动')) {
        return chatResult(
          JSON.stringify({
            scenario: '买理财',
            items: ['先查牌照', '小额试水', '合同写明托管行'],
            caveat: '历史不代表未来',
          }),
        )
      }
      return null // verdict 润色走 fallback
    })
    const { getXRay } = await import('./get-xray')
    const first = await getXRay('mock-danger', '买理财')
    expect(first.nextSteps?.items).toHaveLength(3)
    expect(first.nextSteps?.scenario).toBe('买理财')
    const callsAfterFirst = chatOnceMock.mock.calls.length

    // 同 id 不同 scenario：缓存 key 不同 → 重新分析并再次调用 LLM
    const second = await getXRay('mock-danger', '入职')
    expect(second.nextSteps?.scenario).toBe('买理财') // mock 固定返回
    expect(chatOnceMock.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })

  it('scenario 不传 → 只发一次 LLM 调用（verdict 润色）', async () => {
    llmAvailableMock.mockReturnValue(true)
    chatOnceMock.mockResolvedValue(null)
    const { getXRay } = await import('./get-xray')
    await getXRay('mock-danger')
    expect(chatOnceMock).toHaveBeenCalledTimes(1)
  })
})
