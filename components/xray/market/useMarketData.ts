'use client'

import { useEffect, useState } from 'react'
import type { FundFlowDay, KlineBar, QuoteSnapshot } from '@/lib/data/adapters/market'

export interface MarketData {
  quote: QuoteSnapshot | null
  kline: KlineBar[]
  fflow: FundFlowDay[]
  loading: boolean
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    return json.ok ? (json.data as T) : null
  } catch {
    return null
  }
}

/** 行情区数据：quote 15s 轮询，kline/fflow 一次性加载 */
export function useMarketData(code: string | undefined): MarketData {
  const [quote, setQuote] = useState<QuoteSnapshot | null>(null)
  const [kline, setKline] = useState<KlineBar[]>([])
  const [fflow, setFflow] = useState<FundFlowDay[]>([])
  const [loading, setLoading] = useState(true)
  const id = code?.replace(/\D/g, '')

  useEffect(() => {
    if (!id) return
    let alive = true
    setLoading(true)
    Promise.all([
      getJson<QuoteSnapshot>(`/api/market/quote/${id}`),
      getJson<KlineBar[]>(`/api/market/kline/${id}`),
      getJson<FundFlowDay[]>(`/api/market/fflow/${id}`),
    ]).then(([q, k, f]) => {
      if (!alive) return
      setQuote(q); setKline(k ?? []); setFflow(f ?? [])
      setLoading(false)
    })
    const timer = setInterval(async () => {
      const q = await getJson<QuoteSnapshot>(`/api/market/quote/${id}`)
      if (alive && q) setQuote(q)
    }, 15000)
    return () => { alive = false; clearInterval(timer) }
  }, [id])

  return { quote, kline, fflow, loading }
}
