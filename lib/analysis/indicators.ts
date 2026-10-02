/** 技术指标纯函数：由日 K 收盘价派生，供 PRO 行情区副图使用。 */

export function ema(values: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1)
  const out: (number | null)[] = []
  let prev: number | null = null
  values.forEach((v, i) => {
    prev = prev === null ? (i === 0 ? v : null) : v * k + prev * (1 - k)
    // 用简单均值初始化：前 period 个用累计均值，之后走 EMA
    if (i < period) {
      const seed = values.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1)
      out.push(i === period - 1 ? seed : null)
      if (i === period - 1) prev = seed
    } else {
      out.push(prev)
    }
  })
  return out
}

/** MACD(12,26,9)：返回 dif / dea / hist 序列（前 33 位为 null） */
export function macd(closes: number[]): { dif: (number | null)[]; dea: (number | null)[]; hist: (number | null)[] } {
  const dif = ema(closes, 12).map((fast, i) => {
    const slow = ema(closes, 26)[i]
    return fast === null || slow === null ? null : fast - slow
  })
  const valid = dif.filter((v): v is number => v !== null)
  const deaValid = ema(valid, 9)
  const dea: (number | null)[] = dif.map((v, i) => (v === null ? null : deaValid[i - (dif.length - valid.length)] ?? null))
  const hist = dif.map((v, i) => (v === null || dea[i] === null ? null : (v - dea[i]!) * 2))
  return { dif, dea, hist }
}

/** RSI(14)，Wilder 平滑 */
export function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null)
  let gain = 0, loss = 0
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    const g = Math.max(change, 0), l = Math.max(-change, 0)
    if (i <= period) {
      gain += g; loss += l
      if (i === period) {
        gain /= period; loss /= period
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
      }
    } else {
      gain = (gain * (period - 1) + g) / period
      loss = (loss * (period - 1) + l) / period
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
    }
  }
  return out
}

/** BOLL(20, 2)：中轨 MA20 + 上下轨 */
export function boll(closes: number[], period = 20, mult = 2) {
  const mid = closes.map((_, i) =>
    i < period - 1 ? null : closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period,
  )
  const upper = closes.map((_, i) => {
    if (i < period - 1) return null
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period)
    return mean + mult * sd
  })
  const lower = closes.map((_, i) => {
    if (i < period - 1 || upper[i] === null || mid[i] === null) return null
    return mid[i]! - (upper[i]! - mid[i]!)
  })
  return { mid, upper, lower }
}

/** CCI(20)：典型价 (H+L+C)/3 偏离度 */
export function cci(highs: number[], lows: number[], closes: number[], period = 20): (number | null)[] {
  const tp = highs.map((h, i) => (h + lows[i] + closes[i]) / 3)
  return tp.map((_, i) => {
    if (i < period - 1) return null
    const slice = tp.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const md = slice.reduce((a, b) => a + Math.abs(b - mean), 0) / period
    return md === 0 ? 0 : (tp[i] - mean) / (0.015 * md)
  })
}
