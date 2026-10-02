'use client'

import { useEffect, useState } from 'react'

export interface TencentQuote {
  price: number
  prevClose: number
  change: number
  changePct: number // %
  open: number
  high: number
  low: number
  time: string // MM-DD HH:MM
  totalCapYi: number | null // 总市值，亿元
}

/** '600926.SH' → 'sh600926'；非 A 股代码返回 null */
export function aShareQtSymbol(stockCode?: string): string | null {
  const match = /^(\d{6})\.(SH|SZ)$/.exec(stockCode ?? '')
  if (!match) return null
  return `${match[2].toLowerCase()}${match[1]}`
}

/** 解析 qt.gtimg.cn 的 v_sh600926="..." 行（GBK 已解码为字符串） */
export function parseTencentQuote(text: string, symbol: string): TencentQuote | null {
  const match = new RegExp(`v_${symbol}="([^"]*)"`).exec(text)
  if (!match) return null
  const fields = match[1].split('~')
  if (fields.length < 35) return null
  const num = (i: number): number | null => {
    const value = Number(fields[i])
    return Number.isFinite(value) ? value : null
  }
  const price = num(3)
  const prevClose = num(4)
  if (price === null || prevClose === null || price <= 0) return null

  const rawTime = fields[30] ?? ''
  const time = /^\d{12}/.test(rawTime)
    ? `${rawTime.slice(4, 6)}-${rawTime.slice(6, 8)} ${rawTime.slice(8, 10)}:${rawTime.slice(10, 12)}`
    : ''
  const cap = num(45)

  return {
    price,
    prevClose,
    change: num(31) ?? Math.round((price - prevClose) * 100) / 100,
    changePct: num(32) ?? 0,
    open: num(5) ?? 0,
    high: num(33) ?? 0,
    low: num(34) ?? 0,
    time,
    totalCapYi: cap !== null && cap > 0 ? cap : null,
  }
}

const POLL_MS = 30_000

/** 客户端轮询腾讯行情（免 key、允许跨域）；非 A 股或失败静默为 null */
export function useTencentQuote(stockCode?: string): TencentQuote | null {
  const [quote, setQuote] = useState<TencentQuote | null>(null)
  const symbol = aShareQtSymbol(stockCode)

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    const load = async () => {
      try {
        // 接口返回 GBK，必须按字节解码
        const response = await fetch(`https://qt.gtimg.cn/q=${symbol}`)
        const buffer = await response.arrayBuffer()
        const text = new TextDecoder('gbk').decode(buffer)
        if (!cancelled) setQuote(parseTencentQuote(text, symbol))
      } catch {
        if (!cancelled) setQuote(null)
      }
    }
    void load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [symbol])

  return quote
}
