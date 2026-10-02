import { describe, it, expect, vi, beforeEach } from 'vitest'

const ENV_KEYS = ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL'] as const

describe('GET /api/llm-status', () => {
  beforeEach(() => {
    vi.resetModules()
    for (const k of ENV_KEYS) delete process.env[k]
  })

  async function importRoute() {
    return await import('../../app/api/llm-status/route')
  }

  it('三个环境变量齐全 → 200 { available: true }', async () => {
    process.env.LLM_BASE_URL = 'https://gw.example/v1'
    process.env.LLM_API_KEY = 'sk-test'
    process.env.LLM_MODEL = 'ling-3.1-flash'
    const { GET } = await importRoute()
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ available: true })
  })

  it.each(ENV_KEYS)('缺少 %s → 200 { available: false }', async (missing) => {
    for (const k of ENV_KEYS) {
      if (k !== missing) process.env[k] = 'x'
    }
    const { GET } = await importRoute()
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ available: false })
  })
})
