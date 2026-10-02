import { describe, expect, it } from 'vitest'
import { aShareQtSymbol, parseTencentQuote } from '@/lib/hooks/use-tencent-quote'

// 实测 qt.gtimg.cn q=sh600926 返回（GBK 解码后）
const SAMPLE = 'v_sh600926="1~杭州银行~600926~17.11~16.81~16.79~287697~168929~118768~17.11~84~17.10~178~17.09~107~17.08~356~17.07~45~17.12~11~17.13~342~17.14~183~17.15~329~17.16~208~~20260930161447~0.30~1.78~17.18~16.79~17.11/287697/490801720~287697~49080~0.40~6.15~~17.18~16.79~2.32~1240.30~1240.30~0.88~18.49~15.13~0.90~-303~17.06~4.84~6.52~~~0.03~49080.1720~5.8174~34~   A~GP-A~17.68~2.95~4.32~11.61~0.82~17.26~13.88~1.06~3.01~14.99~7249002548~7249002548~-16.44~16.32~7249002548~~~20.92~-0.12~~CNY~0~___D__F__N~17.20~-1428~";'

describe('aShareQtSymbol', () => {
  it('SH/SZ 代码转为 qt 品种符', () => {
    expect(aShareQtSymbol('600926.SH')).toBe('sh600926')
    expect(aShareQtSymbol('000001.SZ')).toBe('sz000001')
  })

  it('非 A 股代码返回 null', () => {
    expect(aShareQtSymbol(undefined)).toBeNull()
    expect(aShareQtSymbol('mock-healthy')).toBeNull()
  })
})

describe('parseTencentQuote', () => {
  it('按字段位解析 A 股行情', () => {
    const quote = parseTencentQuote(SAMPLE, 'sh600926')!
    expect(quote.price).toBe(17.11)
    expect(quote.prevClose).toBe(16.81)
    expect(quote.change).toBe(0.3)
    expect(quote.changePct).toBe(1.78)
    expect(quote.open).toBe(16.79)
    expect(quote.high).toBe(17.18)
    expect(quote.low).toBe(16.79)
    expect(quote.time).toBe('09-30 16:14')
    expect(quote.totalCapYi).toBe(1240.3)
  })

  it('缺失品种行返回 null', () => {
    expect(parseTencentQuote('v_sz000001="..."', 'sh600926')).toBeNull()
  })

  it('字段数不足或价格非法返回 null', () => {
    expect(parseTencentQuote('v_sh600926="1~杭州银行~600926~17.11"', 'sh600926')).toBeNull()
    expect(parseTencentQuote('v_sh600926="1~杭州银行~600926~0~16.81~16.79~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~~20260930161447~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0"', 'sh600926')).toBeNull()
  })

  it('时间戳缺失时 time 为空但不报错', () => {
    const noTime = SAMPLE.replace('20260930161447', '')
    const quote = parseTencentQuote(noTime, 'sh600926')!
    expect(quote.time).toBe('')
    expect(quote.price).toBe(17.11)
  })
})
