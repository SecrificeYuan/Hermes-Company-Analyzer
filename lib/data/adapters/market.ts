/**
 * 行情数据适配器：腾讯实时快照（qt.gtimg.cn，GBK 编码）+ 东财日 K / 资金流（push2/push2his）。
 * 仅服务端使用（路由内），前端通过 /api/market/* 访问。
 */

export function toSecid(code: string): string | null {
  const digits = code.replace(/\D/g, '')
  if (digits.length !== 6) return null
  // 6/9 开头沪，0/2/3 深，4/8 北交所（东财用 0 前缀不支持，直接判非法）
  if (digits.startsWith('6') || digits.startsWith('9')) return `1.${digits}`
  if (digits.startsWith('0') || digits.startsWith('2') || digits.startsWith('3')) return `0.${digits}`
  return null
}

export interface QuoteSnapshot {
  name: string
  code: string
  price: number
  prevClose: number
  open: number
  high: number
  low: number
  volumeHands: number // 成交量（手）
  amountWan: number // 成交额（万元）
  turnover: number | null // 换手率 %
  amplitude: number | null // 振幅 %
  peTtm: number | null // PE(TTM)，亏损为负
  pb: number | null // 市净率
  floatMktCapYi: number | null // 流通市值（亿）
  totalMktCapYi: number | null // 总市值（亿）
  time: string
}

/** 腾讯行情快照：v_sz002195="1~名称~代码~最新~昨收~今开~..."，GBK 编码。 */
export async function fetchTencentQuote(code: string): Promise<QuoteSnapshot | null> {
  const digits = code.replace(/\D/g, '')
  if (digits.length !== 6) return null
  const prefix = digits.startsWith('6') ? 'sh' : 'sz'
  const res = await fetch(`https://qt.gtimg.cn/q=${prefix}${digits}`, {
    headers: { Referer: 'https://gu.qq.com/' },
    next: { revalidate: 15 },
  })
  if (!res.ok) return null
  const buf = await res.arrayBuffer()
  const text = new TextDecoder('gbk').decode(buf)
  const m = text.match(/="([^"]*)"/)
  if (!m) return null
  const f = m[1].split('~')
  const num = (i: number): number | null => {
    const v = parseFloat(f[i])
    return Number.isFinite(v) ? v : null
  }
  if (!num(3)) return null
  return {
    name: f[1],
    code: f[2],
    price: num(3)!,
    prevClose: num(4) ?? 0,
    open: num(5) ?? 0,
    high: num(33) ?? 0,
    low: num(34) ?? 0,
    volumeHands: num(6) ?? 0,
    amountWan: num(37) ?? 0,
    turnover: num(38),
    amplitude: num(43),
    peTtm: num(39),
    pb: num(46),
    floatMktCapYi: num(44),
    totalMktCapYi: num(45),
    time: f[30] ?? '',
  }
}

export interface KlineBar {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number // 手
}

/** 腾讯前复权日 K：返回 [date, open, close, high, low, volume(手)]。 */
export async function fetchTencentKline(code: string): Promise<KlineBar[]> {
  const digits = code.replace(/\D/g, '')
  if (digits.length !== 6) return []
  const prefix = digits.startsWith('6') ? 'sh' : 'sz'
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${prefix}${digits},day,2023-01-01,2050-12-31,640,qfq`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return []
  const json = await res.json()
  const raw: string[][] = json?.data?.[`${prefix}${digits}`]?.qfqday ?? json?.data?.[`${prefix}${digits}`]?.day ?? []
  return raw.map(([date, open, close, high, low, volume]) => ({
    date, open: +open, close: +close, high: +high, low: +low, volume: +volume,
  }))
}

export interface FundFlowDay {
  date: string
  superLarge: number // 超大单净流入（万元）
  large: number // 大单
  medium: number // 中单
  small: number // 小单
}

/** 东财资金流日 K：f52..f56 = 主力/小单/中单/大单/超大单 净流入（元），转换为万元。 */
export async function fetchEastmoneyFundFlow(secid: string): Promise<FundFlowDay[]> {
  const url =
    `https://push2.eastmoney.com/api/qt/stock/fflow/daykline/get?secid=${secid}` +
    `&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56&klt=101`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return []
  const json = await res.json()
  const klines: string[] = json?.data?.klines ?? []
  return klines.map((s) => {
    const [date, main, small, medium, large, superLarge] = s.split(',')
    void main
    const wan = (v: string) => parseFloat(v) / 10000
    return { date, superLarge: wan(superLarge), large: wan(large), medium: wan(medium), small: wan(small) }
  })
}
