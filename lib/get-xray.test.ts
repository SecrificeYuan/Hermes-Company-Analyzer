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

  it('verdict 润色风险档被模型改成 green → 回退模板', async () => {    llmAvailableMock.mockReturnValue(true)
    chatOnceMock.mockResolvedValue(
      chatResult(JSON.stringify({ verdict: '改过的结论', advice: '改过的建议', overallRisk: 'green' })),
    )
    const { getXRay } = await import('./get-xray')
    const xray = await getXRay('mock-danger')
    expect(xray.overallRisk).not.toBe('green')
    expect(xray.verdict).not.toBe('改过的结论')
    expect(xray.advice).not.toBe('改过的建议')
  })

  it('verdict 润色文本含面板不存在的百分数（99%）→ 回退模板', async () => {
    llmAvailableMock.mockReturnValue(true)
    chatOnceMock.mockResolvedValue(
      chatResult(
        JSON.stringify({
          verdict: '实际血条 99%，稳得很',
          advice: '随便买',
          overallRisk: 'red',
        }),
      ),
    )
    const { getXRay } = await import('./get-xray')
    const xray = await getXRay('mock-danger')
    expect(xray.verdict).not.toContain('99%')
    expect(xray.advice).not.toBe('随便买')
  })

  it('verdict 润色文本百分数可溯源（血条真实分数）→ 采用润色结果', async () => {
    llmAvailableMock.mockReturnValue(true)
    const { getXRay } = await import('./get-xray')
    // 先用无 LLM 路径拿到模板，读出血条真实分数
    llmAvailableMock.mockReturnValue(false)
    const template = await getXRay('mock-danger')
    llmAvailableMock.mockReturnValue(true)
    const hpScore = template.hp.score
    const refinedVerdict = `润色后的结论：血条仅 ${hpScore}%，风险极高`
    const refinedAdvice = '润色后的建议：立即止损'
    chatOnceMock.mockImplementation(async ({ messages }: { messages: { role: string; content: string | null }[] }) => {
      const sys = messages.find((m) => m.role === 'system')?.content ?? ''
      // 只响应 verdict 润色调用（行动建议调用的 system 含「行动项」）
      if (sys.includes('行动项')) return null
      return chatResult(
        JSON.stringify({ verdict: refinedVerdict, advice: refinedAdvice, overallRisk: template.overallRisk }),
      )
    })
    // 换 scenario 避开模板缓存 key
    const xray = await getXRay('mock-danger', '尽调')
    expect(xray.verdict).toBe(refinedVerdict)
    expect(xray.advice).toBe(refinedAdvice)
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
